import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PaymentMethod } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

function parsePaymentMethod(value: unknown): PaymentMethod | null {
  const paymentMethod = normalizeString(value).toUpperCase();
  if ((Object.values(PaymentMethod) as string[]).includes(paymentMethod)) {
    return paymentMethod as PaymentMethod;
  }
  return null;
}

function toArea(address: string) {
  const base = address.split(",")[0]?.trim() || address.trim();
  return base.slice(0, 72);
}

function getContactState(
  delivery: { status: string; customerId: string; courierId: string | null },
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

  const policy = evaluateContactPolicy({
    viewerId: viewer?.id,
    viewerRole: viewer?.role,
    unlockedByStatus,
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint: rules.contact.unlockStatusHint,
  });

  return {
    contactLocked: policy.contactLocked,
    contactUnlockStatusHint: policy.contactUnlockStatusHint,
    canContact: Boolean(policy.canRevealContact && (isParticipant || isAdmin)),
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

  const deliveries = await prisma.tiakDelivery.findMany({
    where: { status: "REQUESTED" },
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
      orderId: true,
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
    deliveries.map((delivery) => {
      const contact = getContactState(delivery, {
        id: session?.user?.id,
        role: session?.user?.role,
      });

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
        orderId: delivery.orderId,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
        customer: delivery.customer,
        courier: delivery.courier,
        contactLocked: contact.contactLocked,
        contactUnlockStatusHint: contact.contactUnlockStatusHint,
        canContact: contact.canContact,
      };
    })
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
  const orderId = normalizeString(body.orderId) || null;

  if (!pickupAddress || !dropoffAddress) {
    return NextResponse.json(
      { error: "pickupAddress and dropoffAddress are required" },
      { status: 400 }
    );
  }

  if (orderId) {
    const linkedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!linkedOrder) {
      return NextResponse.json({ error: "Linked order not found" }, { status: 404 });
    }

    if (session.user.role !== "ADMIN" && linkedOrder.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden linked order" }, { status: 403 });
    }
  }

  const delivery = await prisma.tiakDelivery.create({
    data: {
      customerId: session.user.id,
      status: "REQUESTED",
      pickupAddress,
      dropoffAddress,
      note,
      priceCents,
      currency,
      paymentMethod,
      orderId,
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
      orderId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const contact = getContactState(delivery, {
    id: session.user.id,
    role: session.user.role,
  });

  return NextResponse.json(
    {
      ...delivery,
      pickupArea: toArea(delivery.pickupAddress),
      dropoffArea: toArea(delivery.dropoffAddress),
      contactLocked: contact.contactLocked,
      contactUnlockStatusHint: contact.contactUnlockStatusHint,
      canContact: contact.canContact,
    },
    { status: 201 }
  );
}
