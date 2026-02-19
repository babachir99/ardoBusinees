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
    return NextResponse.json(
      { error: "PRESTA proposal delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const need = await prisma.prestaNeed.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });

  if (!need) {
    return NextResponse.json({ error: "Need not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = session.user.id === need.customerId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json(
      { error: "PRESTA proposal delegates unavailable. Run npx prisma generate and restart dev server." },
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

  const serviceId = normalizeString((body as { serviceId?: unknown }).serviceId);
  const message = normalizeString((body as { message?: unknown }).message).slice(0, 1200) || null;

  if (!serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }

  const { id } = await params;

  const need = await prisma.prestaNeed.findUnique({
    where: { id },
    select: { id: true, customerId: true, status: true },
  });

  if (!need) {
    return NextResponse.json({ error: "Need not found" }, { status: 404 });
  }

  if (need.status !== "OPEN") {
    return NextResponse.json(
      { error: "NEED_NOT_OPEN", message: "Need is not open for proposals" },
      { status: 409 }
    );
  }

  if (need.customerId === session.user.id) {
    return NextResponse.json({ error: "Cannot propose on your own need" }, { status: 403 });
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
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (service.providerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.prestaProposal.findFirst({
    where: {
      needId: need.id,
      providerId: session.user.id,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_PROPOSED", message: "Provider already proposed for this need" },
      { status: 409 }
    );
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
      return NextResponse.json(
        { error: "ALREADY_PROPOSED", message: "Provider already proposed for this need" },
        { status: 409 }
      );
    }

    throw error;
  }
}
