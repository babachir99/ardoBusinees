import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, PrestaProposalStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hasPrestaProposalDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaNeed?: unknown;
    prestaService?: unknown;
    prestaProposal?: unknown;
  };

  return Boolean(runtimePrisma.prestaNeed && runtimePrisma.prestaService && runtimePrisma.prestaProposal);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function serializeProposal(proposal: {
  id: string;
  needId: string;
  serviceId: string;
  providerId: string;
  message: string | null;
  status: PrestaProposalStatus;
  createdAt: Date;
  updatedAt: Date;
  provider: { id: string; name: string | null; image: string | null };
  service: { id: string; title: string; basePriceCents: number; currency: string; city: string | null };
}) {
  return {
    id: proposal.id,
    needId: proposal.needId,
    serviceId: proposal.serviceId,
    providerId: proposal.providerId,
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    provider: proposal.provider,
    service: proposal.service,
  };
}

export async function GET(
  _request: NextRequest,
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

  const { id } = await params;
  const need = await prisma.prestaNeed.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });

  if (!need) {
    return errorResponse(404, "NEED_NOT_FOUND", "Need not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = session.user.id === need.customerId;
  if (!isAdmin && !isOwner) {
    return errorResponse(403, "FORBIDDEN", "Only need owner or admin can view proposals.");
  }

  const proposals = await prisma.prestaProposal.findMany({
    where: { needId: need.id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      needId: true,
      serviceId: true,
      providerId: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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
    },
  });

  return NextResponse.json(proposals.map(serializeProposal));
}

export async function POST(
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
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const serviceId = normalizeString((body as { serviceId?: unknown }).serviceId);
  const message = normalizeString((body as { message?: unknown }).message).slice(0, 1200) || null;

  if (!serviceId) {
    return errorResponse(400, "SERVICE_ID_REQUIRED", "serviceId is required.");
  }

  const { id } = await params;

  const need = await prisma.prestaNeed.findUnique({
    where: { id },
    select: { id: true, customerId: true, status: true },
  });

  if (!need) {
    return errorResponse(404, "NEED_NOT_FOUND", "Need not found.");
  }

  if (need.status !== "OPEN") {
    return errorResponse(409, "NEED_NOT_OPEN", "Need is not open for proposals.");
  }

  if (need.customerId === session.user.id) {
    return errorResponse(403, "FORBIDDEN", "Cannot propose on your own need.");
  }

  const service = await prisma.prestaService.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      providerId: true,
      isActive: true,
    },
  });

  if (!service || !service.isActive) {
    return errorResponse(404, "SERVICE_NOT_FOUND", "Service not found.");
  }

  if (service.providerId !== session.user.id) {
    return errorResponse(403, "FORBIDDEN", "Only the service owner can create this proposal.");
  }

  const existing = await prisma.prestaProposal.findFirst({
    where: {
      needId: need.id,
      providerId: session.user.id,
    },
    select: { id: true },
  });

  if (existing) {
    return errorResponse(409, "ALREADY_PROPOSED", "Provider already proposed for this need.");
  }

  try {
    const proposal = await prisma.prestaProposal.create({
      data: {
        needId: need.id,
        serviceId: service.id,
        providerId: session.user.id,
        message,
        status: PrestaProposalStatus.PENDING,
      },
      select: {
        id: true,
        needId: true,
        serviceId: true,
        providerId: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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
      },
    });

    return NextResponse.json(serializeProposal(proposal), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse(409, "ALREADY_PROPOSED", "Provider already proposed for this need.");
    }

    throw error;
  }
}
