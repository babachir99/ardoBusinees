import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  PaymentMethod,
  PrestaBookingStatus,
  PrestaNeedStatus,
  PrestaProposalStatus,
  Prisma,
} from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrustedInternalApiUrl } from "@/lib/request-security";

const allowedStatuses = new Set<PrestaProposalStatus>([
  PrestaProposalStatus.ACCEPTED,
  PrestaProposalStatus.REJECTED,
  PrestaProposalStatus.WITHDRAWN,
]);

const acceptRaceNotes =
  "409 INVALID_PROPOSAL_STATE if proposal already processed; 409 ALREADY_ACCEPTED if need already accepted/closed";

const proposalSelect = {
  id: true,
  needId: true,
  serviceId: true,
  providerId: true,
  bookingId: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  need: {
    select: {
      id: true,
      status: true,
      customerId: true,
    },
  },
  provider: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
  service: {
    select: {
      id: true,
      title: true,
      basePriceCents: true,
      currency: true,
      city: true,
      provider: {
        select: {
          sellerProfile: {
            select: { id: true },
          },
        },
      },
    },
  },
} as const;

function hasPrestaProposalDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaNeed?: unknown;
    prestaProposal?: unknown;
    prestaBooking?: unknown;
  };

  return Boolean(runtimePrisma.prestaNeed && runtimePrisma.prestaProposal && runtimePrisma.prestaBooking);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const raw = normalizeString(value).toUpperCase();
  const allowed = new Set<PaymentMethod>(Object.values(PaymentMethod));
  if (allowed.has(raw as PaymentMethod)) {
    return raw as PaymentMethod;
  }
  return PaymentMethod.CASH;
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

type ProposalView = {
  id: string;
  needId: string;
  serviceId: string;
  providerId: string;
  bookingId: string | null;
  message: string | null;
  status: PrestaProposalStatus;
  createdAt: Date;
  updatedAt: Date;
  need: { id: string; status: PrestaNeedStatus; customerId: string };
  provider: { id: string; name: string | null; image: string | null };
  service: {
    id: string;
    title: string;
    basePriceCents: number;
    currency: string;
    city: string | null;
    provider: { sellerProfile: { id: string } | null };
  };
};

type BookingView = {
  id: string;
  status: PrestaBookingStatus;
  serviceId: string;
  customerId: string;
  providerId: string;
  createdAt: Date;
  orderId: string | null;
};

function serializeProposal(proposal: ProposalView) {
  return {
    id: proposal.id,
    needId: proposal.needId,
    serviceId: proposal.serviceId,
    providerId: proposal.providerId,
    bookingId: proposal.bookingId,
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    need: proposal.need,
    provider: proposal.provider,
    service: {
      id: proposal.service.id,
      title: proposal.service.title,
      basePriceCents: proposal.service.basePriceCents,
      currency: proposal.service.currency,
      city: proposal.service.city,
    },
  };
}

function serializeBooking(booking: BookingView) {
  return {
    id: booking.id,
    status: booking.status,
    serviceId: booking.serviceId,
    customerId: booking.customerId,
    providerId: booking.providerId,
    createdAt: booking.createdAt,
    orderId: booking.orderId,
  };
}

function okResponse(params: {
  proposal: ProposalView;
  needStatus: PrestaNeedStatus;
  rejectedCount: number;
  booking: BookingView | null;
  paymentInitialization?: unknown;
  includeAcceptRaceNotes?: boolean;
}) {
  return NextResponse.json({
    proposal: serializeProposal(params.proposal),
    needStatus: params.needStatus,
    rejectedCount: params.rejectedCount,
    booking: params.booking ? serializeBooking(params.booking) : null,
    ...(params.paymentInitialization !== undefined ? { paymentInitialization: params.paymentInitialization } : {}),
    ...(params.includeAcceptRaceNotes ? { acceptRaceNotes } : {}),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasPrestaProposalDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA proposal delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const body = await request.json().catch(() => null);
  const nextStatus = normalizeString((body as { status?: unknown })?.status).toUpperCase();

  if (!allowedStatuses.has(nextStatus as PrestaProposalStatus)) {
    return errorResponse(400, "INVALID_STATUS", "Unsupported proposal status transition.");
  }

  const targetStatus = nextStatus as PrestaProposalStatus;
  const paymentMethod = parsePaymentMethod((body as { paymentMethod?: unknown })?.paymentMethod);
  const paymentProvider = normalizeString((body as { provider?: unknown })?.provider) || "provider_pending";

  const { id } = await params;

  const existing = await prisma.prestaProposal.findUnique({
    where: { id },
    select: proposalSelect,
  });

  if (!existing) {
    return errorResponse(404, "PROPOSAL_NOT_FOUND", "Proposal not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isNeedOwner = session.user.id === existing.need.customerId;
  const isProvider = session.user.id === existing.providerId;

  if (targetStatus === PrestaProposalStatus.WITHDRAWN) {
    if (!isProvider && !isAdmin) {
      return errorResponse(403, "FORBIDDEN", "Only provider or admin can withdraw this proposal.");
    }

    if (existing.status !== PrestaProposalStatus.PENDING) {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal not pending.");
    }

    const updated = await prisma.prestaProposal.updateMany({
      where: {
        id: existing.id,
        status: PrestaProposalStatus.PENDING,
      },
      data: { status: PrestaProposalStatus.WITHDRAWN },
    });

    if (updated.count === 0) {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal not pending.");
    }

    const proposal = await prisma.prestaProposal.findUnique({
      where: { id: existing.id },
      select: proposalSelect,
    });

    if (!proposal) {
      return errorResponse(404, "PROPOSAL_NOT_FOUND", "Proposal not found.");
    }

    return okResponse({
      proposal,
      needStatus: proposal.need.status,
      rejectedCount: 0,
      booking: null,
    });
  }

  if (!isNeedOwner && !isAdmin) {
    return errorResponse(403, "FORBIDDEN", "Only need owner or admin can manage this proposal.");
  }

  if (targetStatus === PrestaProposalStatus.REJECTED) {
    if (existing.status === PrestaProposalStatus.ACCEPTED) {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Accepted proposal cannot be rejected.");
    }

    const proposal = await prisma.prestaProposal.update({
      where: { id: existing.id },
      data: { status: PrestaProposalStatus.REJECTED },
      select: proposalSelect,
    });

    return okResponse({
      proposal,
      needStatus: proposal.need.status,
      rejectedCount: 0,
      booking: null,
    });
  }

  if (existing.status === PrestaProposalStatus.ACCEPTED && existing.bookingId) {
    const currentBooking = await prisma.prestaBooking.findUnique({
      where: { id: existing.bookingId },
      select: {
        id: true,
        status: true,
        serviceId: true,
        customerId: true,
        providerId: true,
        createdAt: true,
        orderId: true,
      },
    });

    const currentProposal = await prisma.prestaProposal.findUnique({
      where: { id: existing.id },
      select: proposalSelect,
    });

    if (!currentProposal) {
      return errorResponse(404, "PROPOSAL_NOT_FOUND", "Proposal not found.");
    }

    return okResponse({
      proposal: currentProposal,
      needStatus: currentProposal.need.status,
      rejectedCount: 0,
      booking: currentBooking,
      includeAcceptRaceNotes: true,
    });
  }

  if (existing.status !== PrestaProposalStatus.PENDING) {
    return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal not pending.");
  }

  if (existing.need.status !== PrestaNeedStatus.OPEN) {
    return errorResponse(
      409,
      "ALREADY_ACCEPTED",
      "Need already accepted or not open."
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const needUpdated = await tx.prestaNeed.updateMany({
        where: {
          id: existing.needId,
          status: PrestaNeedStatus.OPEN,
        },
        data: { status: PrestaNeedStatus.ACCEPTED },
      });

      if (needUpdated.count === 0) {
        throw new Error("ALREADY_ACCEPTED");
      }

      const acceptedUpdate = await tx.prestaProposal.updateMany({
        where: {
          id: existing.id,
          status: PrestaProposalStatus.PENDING,
        },
        data: { status: PrestaProposalStatus.ACCEPTED },
      });

      if (acceptedUpdate.count === 0) {
        throw new Error("INVALID_PROPOSAL_STATE");
      }

      const rejected = await tx.prestaProposal.updateMany({
        where: {
          needId: existing.needId,
          id: { not: existing.id },
          status: { in: [PrestaProposalStatus.PENDING, PrestaProposalStatus.ACCEPTED] },
        },
        data: { status: PrestaProposalStatus.REJECTED },
      });

      let booking = await tx.prestaBooking.findFirst({
        where: {
          OR: [{ proposalId: existing.id }, { id: existing.bookingId ?? "" }],
        },
        select: {
          id: true,
          status: true,
          serviceId: true,
          customerId: true,
          providerId: true,
          createdAt: true,
          orderId: true,
        },
      });

      if (!booking) {
        try {
          booking = await tx.prestaBooking.create({
            data: {
              serviceId: existing.serviceId,
              customerId: existing.need.customerId,
              providerId: existing.providerId,
              status: PrestaBookingStatus.CONFIRMED,
              quantity: 1,
              totalCents: existing.service.basePriceCents,
              currency: existing.service.currency,
              paymentMethod,
              confirmedAt: new Date(),
              proposalId: existing.id,
            },
            select: {
              id: true,
              status: true,
              serviceId: true,
              customerId: true,
              providerId: true,
              createdAt: true,
              orderId: true,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            booking = await tx.prestaBooking.findFirst({
              where: { proposalId: existing.id },
              select: {
                id: true,
                status: true,
                serviceId: true,
                customerId: true,
                providerId: true,
                createdAt: true,
                orderId: true,
              },
            });
          } else {
            throw error;
          }
        }
      }

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      if (!existing.bookingId || existing.bookingId !== booking.id) {
        await tx.prestaProposal.update({
          where: { id: existing.id },
          data: { bookingId: booking.id },
        });
      }

      if (!existing.bookingId || existing.bookingId !== booking.id) {
        await tx.prestaBooking.updateMany({
          where: { id: booking.id, proposalId: null },
          data: { proposalId: existing.id },
        });
      }

      const proposal = await tx.prestaProposal.findUnique({
        where: { id: existing.id },
        select: proposalSelect,
      });

      if (!proposal) {
        throw new Error("PROPOSAL_NOT_FOUND");
      }

      return {
        proposal,
        needStatus: PrestaNeedStatus.ACCEPTED,
        rejectedCount: rejected.count,
        booking,
      };
    });

    let booking = result.booking;
    let paymentInitialization: unknown | undefined;

    if (paymentMethod !== PaymentMethod.CASH && !booking.orderId) {
      const order = await prisma.order.create({
        data: {
          userId: result.proposal.need.customerId,
          sellerId: result.proposal.service.provider.sellerProfile?.id ?? null,
          buyerName: null,
          buyerEmail: null,
          buyerPhone: null,
          paymentMethod,
          subtotalCents: result.proposal.service.basePriceCents,
          shippingCents: 0,
          feesCents: 0,
          totalCents: result.proposal.service.basePriceCents,
          currency: result.proposal.service.currency,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
        select: { id: true },
      });

      booking = await prisma.prestaBooking.update({
        where: { id: booking.id },
        data: {
          orderId: order.id,
          paymentMethod,
        },
        select: {
          id: true,
          status: true,
          serviceId: true,
          customerId: true,
          providerId: true,
          createdAt: true,
          orderId: true,
        },
      });

      const initializeUrl = getTrustedInternalApiUrl("/api/payments/initialize");
      const initializeResponse = await fetch(initializeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: initializeUrl.origin,
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          orderId: order.id,
          provider: paymentProvider,
        }),
        cache: "no-store",
      });

      paymentInitialization = await initializeResponse.json().catch(() => null);

      if (!initializeResponse.ok) {
        return errorResponse(
          502,
          "PAYMENT_INIT_FAILED",
          "Booking accepted but payment initialization failed."
        );
      }

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "CONFIRMED",
          note: "PRESTA_PROPOSAL_ACCEPTED",
        },
      });
    } else if (booking.orderId) {
      await prisma.orderEvent.create({
        data: {
          orderId: booking.orderId,
          status: "CONFIRMED",
          note: "PRESTA_PROPOSAL_ACCEPTED",
        },
      });
    } else {
      await prisma.activityLog.createMany({
        data: [
          {
            userId: result.proposal.need.customerId,
            action: "PRESTA_PROPOSAL_ACCEPTED",
            entityType: "PrestaProposal",
            entityId: result.proposal.id,
            metadata: {
              needId: result.proposal.needId,
              bookingId: booking.id,
            },
          },
          {
            userId: result.proposal.providerId,
            action: "PRESTA_PROPOSAL_ACCEPTED",
            entityType: "PrestaProposal",
            entityId: result.proposal.id,
            metadata: {
              needId: result.proposal.needId,
              bookingId: booking.id,
            },
          },
        ],
      });
    }

    return okResponse({
      proposal: result.proposal,
      needStatus: result.needStatus,
      rejectedCount: result.rejectedCount,
      booking,
      paymentInitialization,
      includeAcceptRaceNotes: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PROPOSAL_STATE") {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal not pending.");
    }

    if (error instanceof Error && error.message === "ALREADY_ACCEPTED") {
      return errorResponse(
        409,
        "ALREADY_ACCEPTED",
        "Need already accepted or not open."
      );
    }

    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return errorResponse(404, "BOOKING_NOT_FOUND", "Booking not found for accepted proposal.");
    }

    if (error instanceof Error && error.message === "PROPOSAL_NOT_FOUND") {
      return errorResponse(404, "PROPOSAL_NOT_FOUND", "Proposal not found.");
    }

    throw error;
  }
}


/**
 * curl tests (manual):
 * 1) Accept proposal (normal)
 * curl -X PATCH "http://localhost:3000/api/presta/proposals/<PROPOSAL_ID>" -H "Content-Type: application/json" -H "Cookie: <SESSION_COOKIE>" -d "{\"status\":\"ACCEPTED\",\"paymentMethod\":\"CASH\"}"
 * -> 200 {"proposal":{"id":"...","status":"ACCEPTED"},"needStatus":"ACCEPTED","rejectedCount":1,"booking":{"id":"...","status":"CONFIRMED"}}
 *
 * 2) Re-accept same proposal (idempotent)
 * curl -X PATCH "http://localhost:3000/api/presta/proposals/<PROPOSAL_ID>" -H "Content-Type: application/json" -H "Cookie: <SESSION_COOKIE>" -d "{\"status\":\"ACCEPTED\",\"paymentMethod\":\"CASH\"}"
 * -> 200 {"proposal":{"id":"...","status":"ACCEPTED"},"needStatus":"ACCEPTED","rejectedCount":0,"booking":{"id":"...","status":"CONFIRMED"}}
 *
 * 3) Accept another proposal on same need
 * curl -X PATCH "http://localhost:3000/api/presta/proposals/<OTHER_PROPOSAL_ID>" -H "Content-Type: application/json" -H "Cookie: <SESSION_COOKIE>" -d "{\"status\":\"ACCEPTED\",\"paymentMethod\":\"CASH\"}"
 * -> 409 {"error":"ALREADY_ACCEPTED","message":"Need already accepted or not open."}
 */
