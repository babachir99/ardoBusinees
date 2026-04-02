import { NextRequest, NextResponse } from "next/server";
import {
  PaymentLedgerContextType,
  PaymentLedgerStatus,
  PaymentMethod,
  PaymentStatus,
  TiakPayoutStatus,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";
import { isEitherBlocked } from "@/lib/trust-blocks";
import { queueTiakStatusNotification } from "@/lib/tiak/notifications";

const vertical = Vertical.TIAK_TIAK;
const rules = getVerticalRules(vertical);
const allStatuses = ["REQUESTED", "ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED", "CANCELED", "REJECTED"] as const;
const contactUnlockStatuses = ["ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED"] as const;
const PLATFORM_FEE_BPS = 1000;
type TiakStatus = (typeof allStatuses)[number];

function hasTiakDelegates() {
  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: unknown;
    tiakDeliveryEvent?: unknown;
    tiakPayout?: unknown;
  };

  return Boolean(runtimePrisma.tiakDelivery && runtimePrisma.tiakDeliveryEvent && runtimePrisma.tiakPayout);
}

async function releaseExpiredAssignmentForDelivery(deliveryId: string) {
  const now = new Date();

  await prisma.tiakDelivery.updateMany({
    where: {
      id: deliveryId,
      status: "ASSIGNED",
      assignExpiresAt: { lte: now },
    },
    data: {
      status: "REQUESTED",
      courierId: null,
      assignedAt: null,
      assignExpiresAt: null,
    },
  });
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeProofUrl(value: unknown) {
  const text = normalizeString(value);
  if (!text) return null;
  if (!text.startsWith("/uploads/")) return null;
  return text.slice(0, 500);
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
  viewer?: { id?: string | null; role?: string | null },
  blockedByTrust?: boolean
) {
  if (blockedByTrust) {
    return { contactLocked: true, contactUnlockStatusHint: "BLOCKED_USER", canContact: false };
  }

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

function buildTiakPayoutDraft(delivery: { priceCents: number | null; currency: string; courierId: string | null }) {
  const amountTotalCents = delivery.priceCents;
  if (amountTotalCents === null || amountTotalCents <= 0) return null;
  if (!delivery.courierId) return null;

  const platformFeeCents = Math.round((amountTotalCents * PLATFORM_FEE_BPS) / 10000);
  const courierPayoutCents = amountTotalCents - platformFeeCents;

  return {
    courierId: delivery.courierId,
    amountTotalCents,
    platformFeeCents,
    courierPayoutCents,
    currency: delivery.currency || "XOF",
  };
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

  await releaseExpiredAssignmentForDelivery(id);

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

  const blockedByTrust = Boolean(
    session?.user?.id &&
      delivery.courierId &&
      (session.user.id === delivery.customerId || session.user.id === delivery.courierId) &&
      (await isEitherBlocked(delivery.customerId, delivery.courierId))
  );

  const contact = getContactState(delivery, {
    id: session?.user?.id,
    role: session?.user?.role,
  }, blockedByTrust);

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
  const proofUrl = normalizeProofUrl((body as { proofUrl?: unknown }).proofUrl);

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

    if (!isAssignedCourier && !isAdmin) {
      return NextResponse.json({ error: "Only assigned courier can accept" }, { status: 403 });
    }

    if (delivery.status !== "ASSIGNED") {
      return NextResponse.json({ error: "Delivery must be ASSIGNED before ACCEPTED" }, { status: 400 });
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

  const payoutDraft = nextStatus === "DELIVERED" ? buildTiakPayoutDraft(delivery) : null;
  if (nextStatus === "DELIVERED" && !payoutDraft) {
    return NextResponse.json(
      { error: "AMOUNT_UNKNOWN", message: "Unable to compute courier payout amount." },
      { status: 400 }
    );
  }

  if (nextStatus === "DELIVERED" && !proofUrl) {
    return NextResponse.json(
      { error: "PROOF_REQUIRED", message: "proofUrl is required before marking delivery as DELIVERED." },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.tiakDelivery.update({
      where: { id: delivery.id },
      data: {
        status: nextStatus,
        courierId: delivery.courierId,
        assignedAt: delivery.assignedAt,
        assignExpiresAt: nextStatus === "ACCEPTED" ? null : delivery.assignExpiresAt,
        events: {
          create: [
            {
              status: nextStatus,
              note: normalizeString(body.note).slice(0, 600) || null,
              proofUrl,
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

    let payout: {
      id: string;
      status: TiakPayoutStatus;
      amountTotalCents: number;
      platformFeeCents: number;
      courierPayoutCents: number;
      currency: string;
      createdAt: Date;
      deliveryId: string;
    } | null = null;

    if (nextStatus === "DELIVERED" && payoutDraft) {
      const ledger = await tx.paymentLedger.findUnique({
        where: {
          contextType_contextId: {
            contextType: PaymentLedgerContextType.TIAK_DELIVERY,
            contextId: updated.id,
          },
        },
        select: { status: true },
      });

      const initialPayoutStatus =
        ledger?.status === PaymentLedgerStatus.CONFIRMED
          ? TiakPayoutStatus.READY
          : TiakPayoutStatus.PENDING;

      payout = await tx.tiakPayout.upsert({
        where: { deliveryId: updated.id },
        update: {},
        create: {
          deliveryId: updated.id,
          courierId: payoutDraft.courierId,
          amountTotalCents: payoutDraft.amountTotalCents,
          platformFeeCents: payoutDraft.platformFeeCents,
          courierPayoutCents: payoutDraft.courierPayoutCents,
          currency: payoutDraft.currency,
          status: initialPayoutStatus,
        },
        select: {
          id: true,
          status: true,
          amountTotalCents: true,
          platformFeeCents: true,
          courierPayoutCents: true,
          currency: true,
          createdAt: true,
          deliveryId: true,
        },
      });

      if (initialPayoutStatus === TiakPayoutStatus.READY && payout.status === TiakPayoutStatus.PENDING) {
        await tx.tiakPayout.updateMany({
          where: {
            id: payout.id,
            status: TiakPayoutStatus.PENDING,
          },
          data: {
            status: TiakPayoutStatus.READY,
          },
        });

        const refreshedPayout = await tx.tiakPayout.findUnique({
          where: { id: payout.id },
          select: {
            id: true,
            status: true,
            amountTotalCents: true,
            platformFeeCents: true,
            courierPayoutCents: true,
            currency: true,
            createdAt: true,
            deliveryId: true,
          },
        });

        if (refreshedPayout) {
          payout = refreshedPayout;
        }
      }
    }

    return { updated, payout };
  });

  const notificationTasks: Array<Promise<unknown>> = [];

  if (nextStatus === "PICKED_UP" || nextStatus === "DELIVERED") {
    notificationTasks.push(
      queueTiakStatusNotification({
        deliveryId: result.updated.id,
        recipientId: result.updated.customerId,
        trackingStep: nextStatus,
        action: `TIAK_DELIVERY_${nextStatus}`,
        actorId: session.user.id,
      })
    );
  }

  if ((nextStatus === "COMPLETED" || nextStatus === "CANCELED") && result.updated.courierId) {
    notificationTasks.push(
      queueTiakStatusNotification({
        deliveryId: result.updated.id,
        recipientId: result.updated.courierId,
        trackingStep: nextStatus,
        action: `TIAK_DELIVERY_${nextStatus}`,
        actorId: session.user.id,
      })
    );
  }

  if (nextStatus === "REJECTED") {
    notificationTasks.push(
      queueTiakStatusNotification({
        deliveryId: result.updated.id,
        recipientId: result.updated.customerId,
        trackingStep: "REJECTED",
        action: "TIAK_DELIVERY_REJECTED",
        actorId: session.user.id,
      })
    );
  }

  await Promise.allSettled(notificationTasks);

  const contact = getContactState(result.updated, {
    id: session.user.id,
    role: session.user.role,
  });

  return NextResponse.json({
    id: result.updated.id,
    customerId: result.updated.customerId,
    courierId: result.updated.courierId,
    status: result.updated.status,
    pickupArea: toArea(result.updated.pickupAddress),
    dropoffArea: toArea(result.updated.dropoffAddress),
    note: result.updated.note,
    priceCents: result.updated.priceCents,
    currency: result.updated.currency,
    paymentMethod: result.updated.paymentMethod,
    paymentStatus: result.updated.paymentStatus,
    paidAt: result.updated.paidAt,
    orderId: result.updated.orderId,
    assignedAt: result.updated.assignedAt,
    assignExpiresAt: result.updated.assignExpiresAt,
    createdAt: result.updated.createdAt,
    updatedAt: result.updated.updatedAt,
    customer: result.updated.customer,
    courier: result.updated.courier,
    contactLocked: contact.contactLocked,
    contactUnlockStatusHint: contact.contactUnlockStatusHint,
    canContact: contact.canContact,
    job: { id: result.updated.id, status: result.updated.status },
    payout: result.payout,
  });
}


