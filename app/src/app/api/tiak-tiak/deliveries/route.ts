import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrustedInternalApiUrl } from "@/lib/request-security";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";

const vertical = Vertical.TIAK_TIAK;
const rules = getVerticalRules(vertical);
const contactUnlockStatuses = ["ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED"] as const;

function hasTiakDelegates() {
  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: unknown;
    tiakDeliveryEvent?: unknown;
  };

  return Boolean(runtimePrisma.tiakDelivery && runtimePrisma.tiakDeliveryEvent);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parsePositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : null;
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const paymentMethod = normalizeString(value).toUpperCase();
  if ((Object.values(PaymentMethod) as string[]).includes(paymentMethod)) {
    return paymentMethod as PaymentMethod;
  }
  return PaymentMethod.CASH;
}

function toArea(address: string) {
  const base = address.split(",")[0]?.trim() || address.trim();
  return base.slice(0, 72);
}

function getContactState(
  delivery: {
    status: string;
    customerId: string;
    courierId: string | null;
    paymentMethod: PaymentMethod | null;
    paymentStatus: PaymentStatus | null;
  },
  viewer?: { id?: string | null; role?: string | null }
) {
  const isAdmin = viewer?.role === "ADMIN";
  const isParticipant = Boolean(
    viewer?.id &&
      (viewer.id === delivery.customerId || viewer.id === delivery.courierId)
  );

  const unlockedByStatus =
    isParticipant &&
    (contactUnlockStatuses as readonly string[]).includes(delivery.status);
  const hasPaymentMethod = delivery.paymentMethod !== null;
  const isCashPayment = delivery.paymentMethod === PaymentMethod.CASH;
  const requiresPaidContact = !hasPaymentMethod || !isCashPayment;
  const unlockedByPayment = !requiresPaidContact || delivery.paymentStatus === PaymentStatus.PAID;
  const unlockedByStatusAndPayment = unlockedByStatus && unlockedByPayment;
  const unlockStatusHint = !hasPaymentMethod
    ? "ACCEPTED_AND_PAYMENT_METHOD_SET"
    : isCashPayment
      ? "ACCEPTED"
      : "ACCEPTED_AND_PAID";

  const policy = evaluateContactPolicy({
    viewerId: viewer?.id,
    viewerRole: viewer?.role,
    unlockedByStatus: unlockedByStatusAndPayment,
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint,
  });

  return {
    contactLocked: policy.contactLocked,
    contactUnlockStatusHint: policy.contactUnlockStatusHint,
    canContact: Boolean(policy.canRevealContact && (isParticipant || isAdmin)),
  };
}

function serializeDelivery(
  delivery: {
    id: string;
    customerId: string;
    courierId: string | null;
    status: string;
    pickupAddress: string;
    dropoffAddress: string;
    note: string | null;
    priceCents: number | null;
    currency: string;
    paymentMethod: PaymentMethod | null;
    paymentStatus: PaymentStatus | null;
    paidAt: Date | null;
    orderId: string | null;
    assignedAt: Date | null;
    assignExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    customer?: { id: string; name: string | null; image: string | null } | null;
    courier?: { id: string; name: string | null; image: string | null } | null;
  },
  viewer?: { id?: string | null; role?: string | null }
) {
  const contact = getContactState(delivery, viewer);

  return {
    id: delivery.id,
    customerId: delivery.customerId,
    courierId: delivery.courierId,
    status: delivery.status,
    pickupArea: toArea(delivery.pickupAddress),
    dropoffArea: toArea(delivery.dropoffAddress),
    note: delivery.note,
    priceCents: delivery.priceCents,
    currency: delivery.currency,
    paymentMethod: delivery.paymentMethod,
    paymentStatus: delivery.paymentStatus,
    paidAt: delivery.paidAt,
    orderId: delivery.orderId,
    assignedAt: delivery.assignedAt,
    assignExpiresAt: delivery.assignExpiresAt,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    customer: delivery.customer ?? null,
    courier: delivery.courier ?? null,
    contactLocked: contact.contactLocked,
    contactUnlockStatusHint: contact.contactUnlockStatusHint,
    canContact: contact.canContact,
  };
}

export async function GET(request: NextRequest) {
  if (!hasTiakDelegates()) {
    return NextResponse.json(
      { error: "TIAK TIAK delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const takeRaw = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 100) : 20;

  const where = session?.user?.id
    ? session.user.role === "ADMIN"
      ? { status: "REQUESTED" as const }
      : {
          status: "REQUESTED" as const,
          OR: [{ courierId: null }, { courierId: session.user.id }],
        }
    : {
        status: "REQUESTED" as const,
        courierId: null,
      };

  const deliveries = await prisma.tiakDelivery.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      customerId: true,
      courierId: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
      note: true,
      priceCents: true,
      currency: true,
      paymentMethod: true,
      paymentStatus: true,
      paidAt: true,
      orderId: true,
      assignedAt: true,
      assignExpiresAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      courier: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json(
    deliveries.map((delivery) =>
      serializeDelivery(delivery, {
        id: session?.user?.id,
        role: session?.user?.role,
      })
    )
  );
}

export async function POST(request: NextRequest) {
  if (!hasTiakDelegates()) {
    return NextResponse.json(
      { error: "TIAK TIAK delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pickupAddress = normalizeString(body.pickupAddress);
  const dropoffAddress = normalizeString(body.dropoffAddress);
  const note = normalizeString(body.note).slice(0, 1200) || null;
  const priceCents = parsePositiveInt(body.priceCents);
  const currency = normalizeString(body.currency).toUpperCase() || "XOF";
  const paymentMethod = parsePaymentMethod(body.paymentMethod);
  const isOnlinePayment = paymentMethod !== PaymentMethod.CASH && priceCents !== null;

  if (!pickupAddress || !dropoffAddress) {
    return NextResponse.json(
      { error: "pickupAddress and dropoffAddress are required" },
      { status: 400 }
    );
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

  const delivery = await prisma.$transaction(async (tx) => {
    let createdOrderId: string | null = null;

    if (isOnlinePayment && priceCents !== null) {
      const order = await tx.order.create({
        data: {
          userId: customer.id,
          sellerId: null,
          buyerName: customer.name ?? null,
          buyerEmail: customer.email,
          buyerPhone: customer.phone ?? null,
          paymentMethod,
          subtotalCents: priceCents,
          shippingCents: 0,
          feesCents: 0,
          totalCents: priceCents,
          currency,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
        select: { id: true },
      });

      createdOrderId = order.id;
    }

    return tx.tiakDelivery.create({
      data: {
        customerId: session.user.id,
        status: "REQUESTED",
        pickupAddress,
        dropoffAddress,
        note,
        priceCents,
        currency,
        paymentMethod,
        orderId: createdOrderId,
        paymentStatus: isOnlinePayment ? PaymentStatus.PENDING : null,
        paidAt: null,
        assignedAt: null,
        assignExpiresAt: null,
      },
      select: {
        id: true,
        customerId: true,
        courierId: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        note: true,
        priceCents: true,
        currency: true,
        paymentMethod: true,
        paymentStatus: true,
        paidAt: true,
        orderId: true,
        assignedAt: true,
        assignExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        courier: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });
  });

  let paymentInitialization: unknown = null;

  if (isOnlinePayment && delivery.orderId) {
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
        orderId: delivery.orderId,
        provider: normalizeString((body as { provider?: unknown }).provider) || "provider_pending",
      }),
      cache: "no-store",
    });

    paymentInitialization = await initializeResponse.json().catch(() => null);

    if (!initializeResponse.ok) {
      return NextResponse.json(
        {
          error: "Unable to initialize payment",
          delivery: serializeDelivery(delivery, {
            id: session.user.id,
            role: session.user.role,
          }),
          paymentInitialization,
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    {
      ...serializeDelivery(delivery, {
        id: session.user.id,
        role: session.user.role,
      }),
      paymentInitialization,
    },
    { status: 201 }
  );
}

