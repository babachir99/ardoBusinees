import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PaymentMethod, PrestaBookingStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrustedInternalApiUrl } from "@/lib/request-security";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";
import { isEitherBlocked } from "@/lib/trust-blocks";

const vertical = Vertical.PRESTA;
const rules = getVerticalRules(vertical);
const unlockStatusHint = rules.contact.unlockStatusHint;

function hasPrestaDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaService?: unknown;
    prestaBooking?: unknown;
  };

  return Boolean(runtimePrisma.prestaService && runtimePrisma.prestaBooking);
}
const contactUnlockStatuses: PrestaBookingStatus[] = [
  PrestaBookingStatus.CONFIRMED,
  PrestaBookingStatus.PAID,
  PrestaBookingStatus.COMPLETED,
];

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const raw = normalizeString(value).toUpperCase();
  const allowed = new Set<PaymentMethod>(Object.values(PaymentMethod));
  if (allowed.has(raw as PaymentMethod)) {
    return raw as PaymentMethod;
  }
  return PaymentMethod.CASH;
}

function serializeBooking(
  booking: {
    id: string;
    serviceId: string;
    customerId: string;
    providerId: string;
    orderId: string | null;
    status: PrestaBookingStatus;
    quantity: number;
    message: string | null;
    totalCents: number;
    currency: string;
    paymentMethod: PaymentMethod | null;
    confirmedAt: Date | null;
    paidAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  policy: { canRevealContact: boolean; contactLocked: boolean; contactUnlockStatusHint: string | null },
  contactPhone: string | null
) {
  return {
    id: booking.id,
    serviceId: booking.serviceId,
    customerId: booking.customerId,
    providerId: booking.providerId,
    orderId: booking.orderId,
    status: booking.status,
    quantity: booking.quantity,
    message: booking.message,
    totalCents: booking.totalCents,
    currency: booking.currency,
    paymentMethod: booking.paymentMethod,
    confirmedAt: booking.confirmedAt,
    paidAt: booking.paidAt,
    completedAt: booking.completedAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    contactLocked: policy.contactLocked,
    contactUnlockStatusHint: policy.contactUnlockStatusHint,
    ...(policy.canRevealContact ? { contactPhone } : {}),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPrestaDelegates()) {
    return NextResponse.json(
      { error: "PRESTA delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const { id } = await params;

  const service = await prisma.prestaService.findUnique({
    where: { id },
    select: { id: true, providerId: true },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && session.user.id !== service.providerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookings = await prisma.prestaBooking.findMany({
    where: { serviceId: service.id },
    orderBy: [{ createdAt: "desc" }],
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json(
    bookings.map((booking) => ({
      id: booking.id,
      serviceId: booking.serviceId,
      customerId: booking.customerId,
      providerId: booking.providerId,
      orderId: booking.orderId,
      status: booking.status,
      quantity: booking.quantity,
      message: booking.message,
      totalCents: booking.totalCents,
      currency: booking.currency,
      paymentMethod: booking.paymentMethod,
      confirmedAt: booking.confirmedAt,
      paidAt: booking.paidAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      customer: booking.customer,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasPrestaDelegates()) {
    return NextResponse.json(
      { error: "PRESTA delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const quantity = parsePositiveInt(body.quantity ?? 1);
  if (!quantity || quantity > 50) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const message = normalizeString(body.message) || null;
  const paymentMethod = parsePaymentMethod(body.paymentMethod);
  const isOnlinePayment = paymentMethod !== PaymentMethod.CASH;

  const service = await prisma.prestaService.findUnique({
    where: { id },
    select: {
      id: true,
      providerId: true,
      basePriceCents: true,
      currency: true,
      isActive: true,
      contactPhone: true,
      provider: {
        select: {
          id: true,
          phone: true,
          sellerProfile: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!service || !service.isActive) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (service.providerId === session.user.id) {
    return NextResponse.json({ error: "Cannot book your own service" }, { status: 403 });
  }

  if (await isEitherBlocked(session.user.id, service.providerId)) {
    return NextResponse.json({ error: "BLOCKED_USER", message: "Interaction blocked by user safety settings." }, { status: 403 });
  }

  const customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const totalCents = service.basePriceCents * quantity;

  const created = await prisma.$transaction(async (tx) => {
    let orderId: string | null = null;

    if (isOnlinePayment) {
      const order = await tx.order.create({
        data: {
          userId: customer.id,
          sellerId: service.provider.sellerProfile?.id ?? null,
          buyerName: customer.name ?? null,
          buyerEmail: customer.email,
          buyerPhone: customer.phone ?? null,
          paymentMethod,
          subtotalCents: totalCents,
          shippingCents: 0,
          feesCents: 0,
          totalCents,
          currency: service.currency,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
        select: { id: true },
      });

      orderId = order.id;
    }

    const booking = await tx.prestaBooking.create({
      data: {
        serviceId: service.id,
        customerId: customer.id,
        providerId: service.providerId,
        orderId,
        status: PrestaBookingStatus.PENDING,
        quantity,
        message,
        totalCents,
        currency: service.currency,
        paymentMethod,
      },
    });

    return booking;
  });

  let paymentInitialization: unknown = null;

  if (isOnlinePayment && created.orderId) {
    const initializeUrl = getTrustedInternalApiUrl("/api/payments/initialize");
    const initializeResponse = await fetch(initializeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: initializeUrl.origin,
        "x-internal-request": "1",
        ...(process.env.INTERNAL_API_TOKEN
          ? { "x-internal-api-token": process.env.INTERNAL_API_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        orderId: created.orderId,
        provider: normalizeString(body.provider) || "provider_pending",
      }),
      cache: "no-store",
    });

    paymentInitialization = await initializeResponse.json().catch(() => null);

    if (!initializeResponse.ok) {
      return NextResponse.json(
        {
          error: "Unable to initialize payment",
          bookingId: created.id,
          paymentInitialization,
        },
        { status: 502 }
      );
    }
  }

  const unlockedByStatus = contactUnlockStatuses.includes(created.status);
  const policy = evaluateContactPolicy({
    viewerId: session.user.id,
    viewerRole: session.user.role,
    ownerId: service.providerId,
    unlockedByStatus,
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint,
  });

  return NextResponse.json(
    {
      booking: serializeBooking(
        created,
        policy,
        service.contactPhone ?? service.provider.phone ?? null
      ),
      paymentInitialization,
    },
    { status: 201 }
  );
}
