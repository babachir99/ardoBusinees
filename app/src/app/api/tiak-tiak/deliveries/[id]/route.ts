import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";

const vertical = Vertical.TIAK_TIAK;
const rules = getVerticalRules(vertical);
const allStatuses = ["REQUESTED", "ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED", "CANCELED", "REJECTED"] as const;
const contactUnlockStatuses = ["ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED"] as const;
type TiakStatus = (typeof allStatuses)[number];

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

function normalizeStatus(value: unknown): TiakStatus | null {
  const status = normalizeString(value).toUpperCase();
  if ((allStatuses as readonly string[]).includes(status)) {
    return status as TiakStatus;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasTiakDelegates()) {
    return NextResponse.json(
      { error: "TIAK TIAK delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeAddress = searchParams.get("includeAddress") === "1";

  const delivery = await prisma.tiakDelivery.findUnique({
    where: { id },
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

  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const isPublicReadable = delivery.status === "REQUESTED";
  const isAdmin = session?.user?.role === "ADMIN";
  const isParticipant = Boolean(
    session?.user?.id &&
      (session.user.id === delivery.customerId || session.user.id === delivery.courierId)
  );

  if (!isPublicReadable && !isAdmin && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contact = getContactState(delivery, {
    id: session?.user?.id,
    role: session?.user?.role,
  });

  const canSeeFullAddress = includeAddress && (isAdmin || isParticipant);

  return NextResponse.json({
    id: delivery.id,
    customerId: delivery.customerId,
    courierId: delivery.courierId,
    status: delivery.status,
    pickupAddress: canSeeFullAddress ? delivery.pickupAddress : undefined,
    dropoffAddress: canSeeFullAddress ? delivery.dropoffAddress : undefined,
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
    customer: delivery.customer,
    courier: delivery.courier,
    contactLocked: contact.contactLocked,
    contactUnlockStatusHint: contact.contactUnlockStatusHint,
    canContact: contact.canContact,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nextStatus = normalizeStatus(body.status);
  if (!nextStatus) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const delivery = await prisma.tiakDelivery.findUnique({
    where: { id },
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

  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isCustomer = session.user.id === delivery.customerId;
  const isAssignedCourier = session.user.id === delivery.courierId;
  const isCourierRole = session.user.role === "COURIER";

  if (nextStatus === "ACCEPTED") {
    if (!isCourierRole && !isAdmin) {
      return NextResponse.json({ error: "Only courier can accept" }, { status: 403 });
    }
    if (delivery.status !== "REQUESTED") {
      return NextResponse.json({ error: "Delivery is not requestable" }, { status: 400 });
    }
    if (delivery.courierId && delivery.courierId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Delivery already assigned" }, { status: 409 });
    }

    if (delivery.assignExpiresAt && new Date(delivery.assignExpiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "Assignment expired" }, { status: 409 });
    }
  }

  if (nextStatus === "PICKED_UP" || nextStatus === "DELIVERED") {
    if (!isAssignedCourier && !isAdmin) {
      return NextResponse.json({ error: "Only assigned courier can update delivery" }, { status: 403 });
    }

    if (nextStatus === "PICKED_UP" && delivery.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Delivery must be ACCEPTED before PICKED_UP" }, { status: 400 });
    }

    if (nextStatus === "DELIVERED" && delivery.status !== "PICKED_UP") {
      return NextResponse.json({ error: "Delivery must be PICKED_UP before DELIVERED" }, { status: 400 });
    }
  }

  if (nextStatus === "CANCELED") {
    if (!isCustomer && !isAdmin) {
      return NextResponse.json({ error: "Only customer can cancel before pickup" }, { status: 403 });
    }

    if (["PICKED_UP", "DELIVERED", "COMPLETED"].includes(delivery.status)) {
      return NextResponse.json({ error: "Cannot cancel after pickup" }, { status: 400 });
    }
  }

  if (nextStatus === "COMPLETED") {
    if (!isCustomer && !isAdmin) {
      return NextResponse.json({ error: "Only customer or admin can complete" }, { status: 403 });
    }

    if (delivery.status !== "DELIVERED") {
      return NextResponse.json({ error: "Delivery must be DELIVERED before COMPLETED" }, { status: 400 });
    }
  }

  if (nextStatus === "REJECTED") {
    if (!isAssignedCourier && !isAdmin) {
      return NextResponse.json({ error: "Only assigned courier can reject" }, { status: 403 });
    }
  }

  if (nextStatus === "REQUESTED") {
    return NextResponse.json({ error: "Cannot revert status to REQUESTED" }, { status: 400 });
  }

  const updated = await prisma.tiakDelivery.update({
    where: { id: delivery.id },
    data: {
      status: nextStatus,
      courierId:
        nextStatus === "ACCEPTED"
          ? (delivery.courierId ?? session.user.id)
          : delivery.courierId,
      assignedAt: nextStatus === "ACCEPTED" ? (delivery.assignedAt ?? new Date()) : delivery.assignedAt,
      assignExpiresAt: nextStatus === "ACCEPTED" ? null : delivery.assignExpiresAt,
      events: {
        create: [
          {
            status: nextStatus,
            note: normalizeString(body.note).slice(0, 600) || null,
            actorId: session.user.id,
          },
        ],
      },
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

  const contact = getContactState(updated, {
    id: session.user.id,
    role: session.user.role,
  });

  return NextResponse.json({
    id: updated.id,
    customerId: updated.customerId,
    courierId: updated.courierId,
    status: updated.status,
    pickupArea: toArea(updated.pickupAddress),
    dropoffArea: toArea(updated.dropoffAddress),
    note: updated.note,
    priceCents: updated.priceCents,
    currency: updated.currency,
    paymentMethod: updated.paymentMethod,
    paymentStatus: updated.paymentStatus,
    paidAt: updated.paidAt,
    orderId: updated.orderId,
    assignedAt: updated.assignedAt,
    assignExpiresAt: updated.assignExpiresAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    customer: updated.customer,
    courier: updated.courier,
    contactLocked: contact.contactLocked,
    contactUnlockStatusHint: contact.contactUnlockStatusHint,
    canContact: contact.canContact,
  });
}


