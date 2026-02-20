import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  PaymentLedgerContextType,
  PaymentLedgerStatus,
  PrestaBookingStatus,
  PrestaPayoutStatus,
  Prisma,
} from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_FEE_BPS = 1000;

type PayoutView = {
  id: string;
  status: string;
  amountTotalCents: number;
  platformFeeCents: number;
  providerPayoutCents: number;
  currency: string;
};

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function hasPrestaDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaService?: unknown;
    prestaBooking?: unknown;
    prestaPayout?: unknown;
  };

  return Boolean(runtimePrisma.prestaService && runtimePrisma.prestaBooking && runtimePrisma.prestaPayout);
}

function normalizeStatus(value: unknown): PrestaBookingStatus | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (Object.values(PrestaBookingStatus).includes(raw as PrestaBookingStatus)) {
    return raw as PrestaBookingStatus;
  }
  return null;
}

function resolveAmountAndCurrency(params: {
  bookingTotalCents: number | null | undefined;
  bookingCurrency: string | null | undefined;
  serviceBasePriceCents: number | null | undefined;
  serviceCurrency: string | null | undefined;
}) {
  const amountTotalCents =
    typeof params.bookingTotalCents === "number" && params.bookingTotalCents > 0
      ? params.bookingTotalCents
      : typeof params.serviceBasePriceCents === "number" && params.serviceBasePriceCents > 0
        ? params.serviceBasePriceCents
        : null;

  if (amountTotalCents === null) {
    return null;
  }

  const currency =
    (typeof params.bookingCurrency === "string" && params.bookingCurrency.trim()) ||
    (typeof params.serviceCurrency === "string" && params.serviceCurrency.trim()) ||
    "XOF";

  return {
    amountTotalCents,
    currency,
  };
}

async function ensurePrestaPayout(params: {
  bookingId: string;
  providerId: string;
  amountTotalCents: number;
  currency: string;
}): Promise<PayoutView> {
  const runtimePrisma = prisma as unknown as {
    prestaPayout: {
      findUnique: (args: unknown) => Promise<PayoutView | null>;
      create: (args: unknown) => Promise<PayoutView>;
      updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    paymentLedger?: {
      findUnique: (args: unknown) => Promise<{ status: PaymentLedgerStatus } | null>;
    };
  };

  const existing = await runtimePrisma.prestaPayout.findUnique({
    where: { bookingId: params.bookingId },
    select: {
      id: true,
      status: true,
      amountTotalCents: true,
      platformFeeCents: true,
      providerPayoutCents: true,
      currency: true,
    },
  });

  const ledger = runtimePrisma.paymentLedger
    ? await runtimePrisma.paymentLedger.findUnique({
        where: {
          contextType_contextId: {
            contextType: PaymentLedgerContextType.PRESTA_BOOKING,
            contextId: params.bookingId,
          },
        },
        select: { status: true },
      })
    : null;

  const initialPayoutStatus =
    ledger?.status === PaymentLedgerStatus.CONFIRMED
      ? PrestaPayoutStatus.READY
      : PrestaPayoutStatus.PENDING;

  if (existing) {
    if (initialPayoutStatus === PrestaPayoutStatus.READY && existing.status === PrestaPayoutStatus.PENDING) {
      await runtimePrisma.prestaPayout.updateMany({
        where: {
          bookingId: params.bookingId,
          status: PrestaPayoutStatus.PENDING,
        },
        data: {
          status: PrestaPayoutStatus.READY,
        },
      });

      const refreshed = await runtimePrisma.prestaPayout.findUnique({
        where: { bookingId: params.bookingId },
        select: {
          id: true,
          status: true,
          amountTotalCents: true,
          platformFeeCents: true,
          providerPayoutCents: true,
          currency: true,
        },
      });

      if (refreshed) {
        return refreshed;
      }
    }

    return existing;
  }

  const platformFeeCents = Math.round((params.amountTotalCents * PLATFORM_FEE_BPS) / 10000);
  const providerPayoutCents = params.amountTotalCents - platformFeeCents;

  try {
    return await runtimePrisma.prestaPayout.create({
      data: {
        bookingId: params.bookingId,
        providerId: params.providerId,
        amountTotalCents: params.amountTotalCents,
        platformFeeCents,
        providerPayoutCents,
        currency: params.currency,
        status: initialPayoutStatus,
      },
      select: {
        id: true,
        status: true,
        amountTotalCents: true,
        platformFeeCents: true,
        providerPayoutCents: true,
        currency: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const createdByRace = await runtimePrisma.prestaPayout.findUnique({
        where: { bookingId: params.bookingId },
        select: {
          id: true,
          status: true,
          amountTotalCents: true,
          platformFeeCents: true,
          providerPayoutCents: true,
          currency: true,
        },
      });

      if (createdByRace) {
        return createdByRace;
      }
    }

    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasPrestaDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;

  const booking = await prisma.prestaBooking.findUnique({
    where: { id },
    select: {
      id: true,
      serviceId: true,
      customerId: true,
      providerId: true,
      status: true,
      totalCents: true,
      currency: true,
      paymentMethod: true,
      confirmedAt: true,
      paidAt: true,
      completedAt: true,
      service: {
        select: {
          id: true,
          providerId: true,
          basePriceCents: true,
          currency: true,
        },
      },
    },
  });

  if (!booking) {
    return errorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isProviderOwner = session.user.id === booking.providerId;
  const isCustomer = session.user.id === booking.customerId;

  if (!isAdmin && !isProviderOwner && !isCustomer) {
    return errorResponse(403, "FORBIDDEN", "Access denied.");
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const nextStatus = normalizeStatus((body as { status?: unknown }).status);
  if (!nextStatus) {
    return errorResponse(400, "INVALID_STATUS", "Invalid status.");
  }

  if (nextStatus === PrestaBookingStatus.PAID && !isAdmin) {
    return errorResponse(403, "FORBIDDEN", "PAID status can only be set by payment callback.");
  }

  if (nextStatus === PrestaBookingStatus.CONFIRMED && !isProviderOwner && !isAdmin) {
    return errorResponse(403, "FORBIDDEN", "Only provider can confirm booking.");
  }

  if (nextStatus === PrestaBookingStatus.COMPLETED && !isProviderOwner && !isAdmin) {
    return errorResponse(403, "FORBIDDEN", "Only provider can complete booking.");
  }

  if (nextStatus === PrestaBookingStatus.CANCELED && !isCustomer && !isProviderOwner && !isAdmin) {
    return errorResponse(403, "FORBIDDEN", "Access denied.");
  }

  const completableStatuses = new Set<PrestaBookingStatus>([
    PrestaBookingStatus.CONFIRMED,
    PrestaBookingStatus.PAID,
    PrestaBookingStatus.COMPLETED,
  ]);

  if (nextStatus === PrestaBookingStatus.COMPLETED && !completableStatuses.has(booking.status)) {
    return errorResponse(
      400,
      "INVALID_TRANSITION",
      "Booking must be CONFIRMED or PAID before COMPLETED."
    );
  }

  const payoutSeed =
    nextStatus === PrestaBookingStatus.COMPLETED
      ? resolveAmountAndCurrency({
          bookingTotalCents: booking.totalCents,
          bookingCurrency: booking.currency,
          serviceBasePriceCents: booking.service?.basePriceCents,
          serviceCurrency: booking.service?.currency,
        })
      : null;

  if (nextStatus === PrestaBookingStatus.COMPLETED && !payoutSeed) {
    return errorResponse(400, "AMOUNT_UNKNOWN", "Unable to compute payout amount for this booking.");
  }

  if (nextStatus === PrestaBookingStatus.COMPLETED && booking.status === PrestaBookingStatus.COMPLETED) {
    const payout = await ensurePrestaPayout({
      bookingId: booking.id,
      providerId: booking.providerId,
      amountTotalCents: payoutSeed!.amountTotalCents,
      currency: payoutSeed!.currency,
    });

    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
      },
      payout,
    });
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
    select: {
      id: true,
      status: true,
      providerId: true,
      totalCents: true,
      currency: true,
      service: {
        select: {
          basePriceCents: true,
          currency: true,
        },
      },
    },
  });

  let payout: PayoutView | null = null;

  if (nextStatus === PrestaBookingStatus.COMPLETED && payoutSeed) {
    payout = await ensurePrestaPayout({
      bookingId: updated.id,
      providerId: updated.providerId,
      amountTotalCents: payoutSeed.amountTotalCents,
      currency: payoutSeed.currency,
    });
  }

  return NextResponse.json({
    booking: {
      id: updated.id,
      status: updated.status,
    },
    payout,
  });
}
