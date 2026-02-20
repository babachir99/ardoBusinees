import { NextRequest, NextResponse } from "next/server";
import { DisputeContextType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical } from "@/lib/verticals";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

type ContextResolution = {
  contextType: DisputeContextType;
  contextId: string;
  vertical: string;
  referenceId: string;
};

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseContextType(value: unknown): DisputeContextType | null {
  const normalized = normalizeString(value).toUpperCase();
  if ((Object.values(DisputeContextType) as string[]).includes(normalized)) {
    return normalized as DisputeContextType;
  }
  return null;
}

const activeDisputeStatuses = ["OPEN", "IN_REVIEW"] as const;

function hasRequiredDelegates() {
  const runtimePrisma = prisma as unknown as {
    dispute?: unknown;
    order?: unknown;
    prestaBooking?: unknown;
    tiakDelivery?: unknown;
    gpShipment?: unknown;
  };

  return Boolean(
    runtimePrisma.dispute &&
      runtimePrisma.order &&
      runtimePrisma.prestaBooking &&
      runtimePrisma.tiakDelivery &&
      runtimePrisma.gpShipment
  );
}

async function resolveContextOrError(input: {
  contextType: DisputeContextType;
  contextId: string;
  userId: string;
  role: string;
}): Promise<ContextResolution | { error: string; message: string; status: number }> {
  const { contextType, contextId, userId, role } = input;
  const isAdmin = role === "ADMIN";

  if (contextType === DisputeContextType.SHOP_ORDER) {
    const order = await prisma.order.findUnique({
      where: { id: contextId },
      select: {
        id: true,
        userId: true,
        seller: { select: { userId: true } },
      },
    });

    if (!order) {
      return { error: "CONTEXT_NOT_FOUND", message: "Order not found.", status: 404 };
    }

    const canOpen = isAdmin || order.userId === userId || order.seller?.userId === userId;
    if (!canOpen) {
      return { error: "FORBIDDEN", message: "You are not allowed to open a dispute for this order.", status: 403 };
    }

    return {
      contextType,
      contextId: order.id,
      vertical: Vertical.SHOP,
      referenceId: order.id,
    };
  }

  if (contextType === DisputeContextType.PRESTA_BOOKING) {
    const booking = await prisma.prestaBooking.findUnique({
      where: { id: contextId },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        orderId: true,
      },
    });

    if (!booking) {
      return { error: "CONTEXT_NOT_FOUND", message: "Presta booking not found.", status: 404 };
    }

    const canOpen = isAdmin || booking.customerId === userId || booking.providerId === userId;
    if (!canOpen) {
      return { error: "FORBIDDEN", message: "You are not allowed to open a dispute for this booking.", status: 403 };
    }

    return {
      contextType,
      contextId: booking.id,
      vertical: Vertical.PRESTA,
      referenceId: booking.orderId ?? booking.id,
    };
  }

  if (contextType === DisputeContextType.TIAK_DELIVERY) {
    const delivery = await prisma.tiakDelivery.findUnique({
      where: { id: contextId },
      select: {
        id: true,
        customerId: true,
        courierId: true,
        orderId: true,
      },
    });

    if (!delivery) {
      return { error: "CONTEXT_NOT_FOUND", message: "Tiak delivery not found.", status: 404 };
    }

    const canOpen = isAdmin || delivery.customerId === userId || delivery.courierId === userId;
    if (!canOpen) {
      return { error: "FORBIDDEN", message: "You are not allowed to open a dispute for this delivery.", status: 403 };
    }

    return {
      contextType,
      contextId: delivery.id,
      vertical: Vertical.TIAK_TIAK,
      referenceId: delivery.orderId ?? delivery.id,
    };
  }

  const shipment = await prisma.gpShipment.findUnique({
    where: { id: contextId },
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      transporterId: true,
      bookingId: true,
    },
  });

  if (!shipment) {
    return { error: "CONTEXT_NOT_FOUND", message: "GP shipment not found.", status: 404 };
  }

  const canOpen =
    isAdmin ||
    shipment.senderId === userId ||
    shipment.receiverId === userId ||
    shipment.transporterId === userId;

  if (!canOpen) {
    return { error: "FORBIDDEN", message: "You are not allowed to open a dispute for this shipment.", status: 403 };
  }

  return {
    contextType,
    contextId: shipment.id,
    vertical: Vertical.GP,
    referenceId: shipment.bookingId ?? shipment.id,
  };
}

function serializeDispute(dispute: {
  id: string;
  contextType: DisputeContextType;
  contextId: string;
  reason: string;
  description: string | null;
  status: string;
  openedById: string;
  assignedAdminId: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: dispute.id,
    contextType: dispute.contextType,
    contextId: dispute.contextId,
    reason: dispute.reason,
    description: dispute.description,
    status: dispute.status,
    openedById: dispute.openedById,
    assignedAdminId: dispute.assignedAdminId,
    resolutionNote: dispute.resolutionNote,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  if (!hasRequiredDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Dispute delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") !== "0";
  const adminMode = searchParams.get("admin") === "1";

  if (session.user.role === "ADMIN" && adminMode) {
    const disputes = await prisma.dispute.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        contextType: true,
        contextId: true,
        reason: true,
        description: true,
        status: true,
        openedById: true,
        assignedAdminId: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(disputes.map((entry) => serializeDispute(entry)));
  }

  if (!mine) {
    return errorResponse(403, "FORBIDDEN", "Only mine=1 is allowed for non-admin users.");
  }

  const [shopOrders, prestaBookings, tiakDeliveries, gpShipments] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [{ userId: session.user.id }, { seller: { userId: session.user.id } }],
      },
      select: { id: true },
      take: 1000,
    }),
    prisma.prestaBooking.findMany({
      where: {
        OR: [{ customerId: session.user.id }, { providerId: session.user.id }],
      },
      select: { id: true },
      take: 1000,
    }),
    prisma.tiakDelivery.findMany({
      where: {
        OR: [{ customerId: session.user.id }, { courierId: session.user.id }],
      },
      select: { id: true },
      take: 1000,
    }),
    prisma.gpShipment.findMany({
      where: {
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id },
          { transporterId: session.user.id },
        ],
      },
      select: { id: true },
      take: 1000,
    }),
  ]);

  const disputes = await prisma.dispute.findMany({
    where: {
      OR: [
        { openedById: session.user.id },
        {
          contextType: DisputeContextType.SHOP_ORDER,
          contextId: { in: shopOrders.map((entry) => entry.id) },
        },
        {
          contextType: DisputeContextType.PRESTA_BOOKING,
          contextId: { in: prestaBookings.map((entry) => entry.id) },
        },
        {
          contextType: DisputeContextType.TIAK_DELIVERY,
          contextId: { in: tiakDeliveries.map((entry) => entry.id) },
        },
        {
          contextType: DisputeContextType.GP_SHIPMENT,
          contextId: { in: gpShipments.map((entry) => entry.id) },
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      contextType: true,
      contextId: true,
      reason: true,
      description: true,
      status: true,
      openedById: true,
      assignedAdminId: true,
      resolutionNote: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(disputes.map((entry) => serializeDispute(entry)));
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "dispute.create";

  if (!hasRequiredDelegates()) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "Dispute" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(
      errorResponse(
        503,
        "DELEGATE_UNAVAILABLE",
        "Dispute delegates unavailable. Run npx prisma generate and restart dev server."
      )
    );
  }

  const session = await getServerSession(authOptions);
  const actor = { userId: session?.user?.id ?? null, role: session?.user?.role ?? null };
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Dispute" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Dispute" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_BODY", "JSON body is required."));
  }

  const contextType = parseContextType((body as { contextType?: unknown }).contextType);
  const contextId = normalizeString((body as { contextId?: unknown }).contextId);
  const reason = normalizeString((body as { reason?: unknown }).reason).slice(0, 120);
  const descriptionRaw = normalizeString((body as { description?: unknown }).description);
  const description = descriptionRaw ? descriptionRaw.slice(0, 2000) : null;

  if (!contextType || !contextId || !reason) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Dispute" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(
      errorResponse(
        400,
        "INVALID_INPUT",
        "contextType, contextId and reason are required."
      )
    );
  }

  const resolved = await resolveContextOrError({
    contextType,
    contextId,
    userId: session.user.id,
    role: session.user.role,
  });

  if ("error" in resolved) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Dispute", id: contextId },
      outcome: resolved.status === 403 || resolved.status === 401 ? "DENIED" : "CONFLICT",
      reason: resolved.status === 403 || resolved.status === 401 ? AuditReason.FORBIDDEN : resolved.status === 404 ? AuditReason.NOT_FOUND : AuditReason.INVALID_INPUT,
      metadata: { contextType },
    });
    return respond(errorResponse(resolved.status, resolved.error, resolved.message));
  }

  try {
    const dispute = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.dispute.findFirst({
        where: {
          contextType: resolved.contextType,
          contextId: resolved.contextId,
          status: { in: [...activeDisputeStatuses] },
        },
        select: { id: true },
      });

      if (existingActive) {
        throw new Error("DISPUTE_ALREADY_ACTIVE");
      }

      return tx.dispute.create({
        data: {
          contextType: resolved.contextType,
          contextId: resolved.contextId,
          vertical: resolved.vertical,
          referenceId: resolved.referenceId,
          reason,
          description,
          status: "OPEN",
          openedById: session.user.id,
        },
        select: {
          id: true,
          contextType: true,
          contextId: true,
          reason: true,
          description: true,
          status: true,
          openedById: true,
          assignedAdminId: true,
          resolutionNote: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Dispute", id: dispute.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { contextType: dispute.contextType, contextId: dispute.contextId },
    });

    return respond(NextResponse.json({ dispute: serializeDispute(dispute) }, { status: 201 }));
  } catch (error) {
    if (error instanceof Error && error.message === "DISPUTE_ALREADY_ACTIVE") {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Dispute", id: resolved.contextId },
        outcome: "CONFLICT",
        reason: AuditReason.ACTIVE_DISPUTE,
        metadata: { contextType: resolved.contextType },
      });
      return respond(errorResponse(409, "DISPUTE_ALREADY_ACTIVE", "An active dispute already exists for this context."));
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Dispute", id: resolved.contextId },
        outcome: "CONFLICT",
        reason: AuditReason.ACTIVE_DISPUTE,
        metadata: { contextType: resolved.contextType },
      });
      return respond(errorResponse(409, "DISPUTE_ALREADY_ACTIVE", "An active dispute already exists for this context."));
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Dispute", id: resolved.contextId },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
      metadata: { contextType: resolved.contextType },
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
