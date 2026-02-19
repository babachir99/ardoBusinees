import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrestaNeedStatus, PrestaProposalStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    },
  },
} as const;

function hasPrestaProposalDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaNeed?: unknown;
    prestaProposal?: unknown;
  };

  return Boolean(runtimePrisma.prestaNeed && runtimePrisma.prestaProposal);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

type ProposalView = {
  id: string;
  needId: string;
  serviceId: string;
  providerId: string;
  message: string | null;
  status: PrestaProposalStatus;
  createdAt: Date;
  updatedAt: Date;
  need: { id: string; status: PrestaNeedStatus; customerId: string };
  provider: { id: string; name: string | null; image: string | null };
  service: { id: string; title: string; basePriceCents: number; currency: string; city: string | null };
};

function serializeProposal(proposal: ProposalView) {
  return {
    id: proposal.id,
    needId: proposal.needId,
    serviceId: proposal.serviceId,
    providerId: proposal.providerId,
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    need: proposal.need,
    provider: proposal.provider,
    service: proposal.service,
  };
}

function okResponse(
  proposal: ProposalView,
  needStatus: PrestaNeedStatus,
  rejectedCount: number,
  options?: { includeAcceptRaceNotes?: boolean }
) {
  return NextResponse.json({
    proposal: serializeProposal(proposal),
    needStatus,
    rejectedCount,
    ...(options?.includeAcceptRaceNotes ? { acceptRaceNotes } : {}),
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
  const targetStatus = nextStatus as PrestaProposalStatus;

  if (targetStatus === PrestaProposalStatus.WITHDRAWN) {
    if (!isProvider && !isAdmin) {
      return errorResponse(403, "FORBIDDEN", "Only provider or admin can withdraw this proposal.");
    }

    if (existing.status !== PrestaProposalStatus.PENDING) {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal is not pending anymore.");
    }

    const updated = await prisma.prestaProposal.updateMany({
      where: {
        id: existing.id,
        status: PrestaProposalStatus.PENDING,
      },
      data: { status: PrestaProposalStatus.WITHDRAWN },
    });

    if (updated.count === 0) {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal is not pending anymore.");
    }

    const proposal = await prisma.prestaProposal.findUnique({
      where: { id: existing.id },
      select: proposalSelect,
    });

    if (!proposal) {
      return errorResponse(404, "PROPOSAL_NOT_FOUND", "Proposal not found.");
    }

    return okResponse(proposal, proposal.need.status, 0);
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

    return okResponse(proposal, proposal.need.status, 0);
  }

  if (existing.status !== PrestaProposalStatus.PENDING) {
    return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal is not pending anymore.");
  }

  if (existing.need.status !== PrestaNeedStatus.OPEN) {
    return errorResponse(
      409,
      "ALREADY_ACCEPTED",
      "Need is no longer open (already accepted or closed)."
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
      };
    });

    return okResponse(result.proposal, result.needStatus, result.rejectedCount, {
      includeAcceptRaceNotes: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PROPOSAL_STATE") {
      return errorResponse(409, "INVALID_PROPOSAL_STATE", "Proposal is not pending anymore.");
    }

    if (error instanceof Error && error.message === "ALREADY_ACCEPTED") {
      return errorResponse(
        409,
        "ALREADY_ACCEPTED",
        "Need is no longer open (already accepted or closed)."
      );
    }

    if (error instanceof Error && error.message === "PROPOSAL_NOT_FOUND") {
      return errorResponse(404, "PROPOSAL_NOT_FOUND", "Proposal not found.");
    }

    throw error;
  }
}
