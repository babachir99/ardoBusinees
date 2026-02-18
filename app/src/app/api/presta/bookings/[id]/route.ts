import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrestaBookingStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";

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

function normalizeStatus(value: unknown): PrestaBookingStatus | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (Object.values(PrestaBookingStatus).includes(raw as PrestaBookingStatus)) {
    return raw as PrestaBookingStatus;
  }
  return null;
}

export async function PATCH(
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

  const booking = await prisma.prestaBooking.findUnique({
    where: { id },
    include: {
      service: {
        select: {
          id: true,
          providerId: true,
          contactPhone: true,
          provider: {
            select: {
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isProviderOwner = session.user.id === booking.providerId;
  const isCustomer = session.user.id === booking.customerId;

  if (!isAdmin && !isProviderOwner && !isCustomer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nextStatus = normalizeStatus(body.status);
  if (!nextStatus) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (nextStatus === PrestaBookingStatus.PAID && !isAdmin) {
    return NextResponse.json(
      { error: "PAID status can only be set by payment callback." },
      { status: 403 }
    );
  }

  if (nextStatus === PrestaBookingStatus.CONFIRMED && !isProviderOwner && !isAdmin) {
    return NextResponse.json({ error: "Only provider can confirm" }, { status: 403 });
  }

  if (nextStatus === PrestaBookingStatus.COMPLETED && !isProviderOwner && !isAdmin) {
    return NextResponse.json({ error: "Only provider can complete" }, { status: 403 });
  }

  const completableStatuses = new Set<PrestaBookingStatus>([
    PrestaBookingStatus.CONFIRMED,
    PrestaBookingStatus.PAID,
  ]);

  if (
    nextStatus === PrestaBookingStatus.COMPLETED &&
    !completableStatuses.has(booking.status)
  ) {
    return NextResponse.json(
      { error: "Booking must be CONFIRMED or PAID before COMPLETED" },
      { status: 400 }
    );
  }

  if (nextStatus === PrestaBookingStatus.CANCELED && !isCustomer && !isProviderOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: {
    status: PrestaBookingStatus;
    confirmedAt?: Date | null;
    completedAt?: Date | null;
    paidAt?: Date | null;
  } = {
    status: nextStatus,
  };

  if (nextStatus === PrestaBookingStatus.CONFIRMED) {
    data.confirmedAt = new Date();
  }

  if (nextStatus === PrestaBookingStatus.PAID) {
    data.paidAt = new Date();
  }

  if (nextStatus === PrestaBookingStatus.COMPLETED) {
    data.completedAt = new Date();
  }

  const updated = await prisma.prestaBooking.update({
    where: { id: booking.id },
    data,
  });

  const unlockStatuses = new Set<PrestaBookingStatus>([
    PrestaBookingStatus.CONFIRMED,
    PrestaBookingStatus.PAID,
    PrestaBookingStatus.COMPLETED,
  ]);

  const policy = evaluateContactPolicy({
    viewerId: session.user.id,
    viewerRole: session.user.role,
    ownerId: booking.providerId,
    unlockedByStatus: unlockStatuses.has(updated.status),
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint,
  });

  return NextResponse.json({
    id: updated.id,
    serviceId: updated.serviceId,
    customerId: updated.customerId,
    providerId: updated.providerId,
    orderId: updated.orderId,
    status: updated.status,
    quantity: updated.quantity,
    message: updated.message,
    totalCents: updated.totalCents,
    currency: updated.currency,
    paymentMethod: updated.paymentMethod,
    confirmedAt: updated.confirmedAt,
    paidAt: updated.paidAt,
    completedAt: updated.completedAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    contactLocked: policy.contactLocked,
    contactUnlockStatusHint: policy.contactUnlockStatusHint,
    ...(policy.canRevealContact
      ? { contactPhone: booking.service.contactPhone ?? booking.service.provider.phone ?? null }
      : {}),
  });
}
