import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { normalizeDeliveryStep } from "@/lib/notifications/delivery-step";

const orderedStatuses = ["DROPPED_OFF", "PICKED_UP", "BOARDED", "ARRIVED", "DELIVERED"] as const;

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeNote(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 1000);
}

function normalizeProofUrl(value: unknown) {
  if (value === undefined || value === null) {
    return { value: null as string | null, invalid: false };
  }

  const text = String(value).trim();
  if (!text) {
    return { value: null as string | null, invalid: false };
  }

  if (!text.startsWith("/uploads/")) {
    return { value: null as string | null, invalid: true };
  }

  return { value: text.slice(0, 500), invalid: false };
}

function normalizeProofType(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 100);
}

function isAllowedRole(role: string | undefined) {
  return ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER", "CUSTOMER"].includes(role ?? "");
}

function statusRank(status: string) {
  return orderedStatuses.indexOf(status as (typeof orderedStatuses)[number]);
}

async function loadShipment(id: string) {
  const runtimePrisma = prisma as unknown as {
    gpShipment?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        code: string;
        status: string;
        senderId: string | null;
        receiverId: string | null;
        transporterId: string;
      } | null>;
    };
  };

  if (!runtimePrisma.gpShipment) {
    return { error: errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate"), shipment: null };
  }

  const shipment = await runtimePrisma.gpShipment.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      senderId: true,
      receiverId: true,
      transporterId: true,
    },
  });

  return { error: null, shipment };
}

function canReadTimeline(params: {
  role: string | undefined;
  userId: string;
  shipment: { senderId: string | null; receiverId: string | null; transporterId: string };
}) {
  if (params.role === "ADMIN") return true;
  return (
    params.shipment.senderId === params.userId ||
    params.shipment.receiverId === params.userId ||
    params.shipment.transporterId === params.userId
  );
}

function canWriteTimeline(params: {
  role: string | undefined;
  userId: string;
  shipment: { transporterId: string };
}) {
  if (params.role === "ADMIN") return true;
  return params.shipment.transporterId === params.userId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }

  if (!isAllowedRole(session.user.role)) {
    return respond(errorResponse(403, "FORBIDDEN", "Access denied."));
  }

  const { id } = await params;

  try {
    const loaded = await loadShipment(id);
    if (loaded.error) return respond(loaded.error);

    if (!loaded.shipment) {
      return respond(errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found."));
    }

    if (!canReadTimeline({ role: session.user.role, userId: session.user.id, shipment: loaded.shipment })) {
      return respond(errorResponse(403, "FORBIDDEN", "Access denied."));
    }

    const runtimePrisma = prisma as unknown as {
      gpShipmentEvent: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    };

    const events = await runtimePrisma.gpShipmentEvent.findMany({
      where: { shipmentId: loaded.shipment.id },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        note: true,
        proofUrl: true,
        proofType: true,
      },
    });

    return respond(
      NextResponse.json({
        shipment: {
          id: loaded.shipment.id,
          code: loaded.shipment.code,
          status: loaded.shipment.status,
        },
        events,
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CAS_CONFLICT") {
      return respond(errorResponse(409, "CONFLICT", "Shipment status changed concurrently. Refresh and retry."));
    }

    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") {
      return respond(errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found."));
    }

    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const actorBase = async () => {
    const session = await getServerSession(authOptions);
    return { session, actor: { userId: session?.user?.id ?? null, role: session?.user?.role ?? null } };
  };

  const { session, actor } = await actorBase();

  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment", id },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_BODY", "Invalid JSON body."));
  }

  const requestedStatus = String((body as { status?: unknown }).status ?? "").toUpperCase();
  const providedCode = String((body as { code?: unknown }).code ?? "").trim();
  const note = normalizeNote((body as { note?: unknown }).note);
  const parsedProof = normalizeProofUrl((body as { proofUrl?: unknown }).proofUrl);
  const proofType = normalizeProofType((body as { proofType?: unknown }).proofType);

  if (parsedProof.invalid) {
    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment", id },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_PROOF_URL", "proofUrl must use internal uploads path."));
  }

  if (!parsedProof.value) {
    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment", id },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "PROOF_REQUIRED", "proofUrl is required for tracking events."));
  }

  if (!orderedStatuses.includes(requestedStatus as (typeof orderedStatuses)[number])) {
    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment", id },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_STATUS", "Invalid tracking status."));
  }

  try {
    const loaded = await loadShipment(id);
    if (loaded.error) return respond(loaded.error);

    if (!loaded.shipment) {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id },
        outcome: "CONFLICT",
        reason: AuditReason.NOT_FOUND,
      });
      return respond(errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found."));
    }

    if (!canWriteTimeline({ role: session.user.role, userId: session.user.id, shipment: loaded.shipment })) {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id: loaded.shipment.id },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
      });
      return respond(errorResponse(403, "FORBIDDEN", "Only assigned transporter can add events."));
    }

    if (!providedCode || providedCode !== loaded.shipment.code) {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id: loaded.shipment.id },
        outcome: "DENIED",
        reason: AuditReason.INVALID_INPUT,
      });
      return respond(errorResponse(400, "INVALID_CODE", "Shipment code mismatch."));
    }

    const currentRank = statusRank(loaded.shipment.status);
    const nextRank = statusRank(requestedStatus);

    if (nextRank === currentRank) {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id: loaded.shipment.id },
        outcome: "CONFLICT",
        reason: AuditReason.DUPLICATE_EVENT,
      });
      return respond(errorResponse(409, "DUPLICATE_EVENT", "This status is already recorded."));
    }

    if (nextRank < currentRank || nextRank > currentRank + 1) {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id: loaded.shipment.id },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(errorResponse(409, "INVALID_TRANSITION", "Status transition not allowed."));
    }

    const result = await prisma.$transaction(async (tx) => {
      const txRuntime = tx as unknown as {
        gpShipment: {
          updateMany: (args: unknown) => Promise<{ count: number }>;
          findUnique: (args: unknown) => Promise<{ id: string; code: string; status: string } | null>;
        };
        gpShipmentEvent: {
          create: (args: unknown) => Promise<{
            id: string;
            status: string;
            createdAt: Date;
            note: string | null;
            proofUrl: string | null;
            proofType: string | null;
          }>;
        };
      };

      const moved = await txRuntime.gpShipment.updateMany({
        where: {
          id: loaded.shipment!.id,
          status: loaded.shipment!.status,
        },
        data: { status: requestedStatus },
      });

      if (moved.count === 0) {
        throw new Error("CAS_CONFLICT");
      }

      const shipment = await txRuntime.gpShipment.findUnique({
        where: { id: loaded.shipment!.id },
        select: { id: true, code: true, status: true },
      });

      if (!shipment) {
        throw new Error("SHIPMENT_NOT_FOUND");
      }

      const event = await txRuntime.gpShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: requestedStatus,
          note,
          proofUrl: parsedProof.value,
          proofType,
          actorId: session.user.id,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          note: true,
          proofUrl: true,
          proofType: true,
        },
      });

      return { shipment, event };
    });

    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment", id: result.shipment.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { status: result.shipment.status },
    });

    auditLog({
      correlationId,
      actor,
      action: "gp.eventCreate",
      entity: { type: "GpShipmentEvent", id: result.event.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { shipmentId: result.shipment.id, status: result.event.status },
    });

    const recipientIds = Array.from(
      new Set([loaded.shipment.senderId, loaded.shipment.receiverId].filter((value): value is string => Boolean(value)))
    );
    const normalizedStep = normalizeDeliveryStep("GP", result.event.status);

    for (const recipientId of recipientIds) {
      await NotificationService.queueEmail({
        userId: recipientId,
        kind: "TRANSACTIONAL",
        templateKey: "delivery_update",
        payload: {
          orderId: loaded.shipment.code,
          trackingStep: normalizedStep,
          eta: "",
          link: `/gp/shipments/${loaded.shipment.id}`,
        },
        dedupeKey: `delivery_update:gp:${loaded.shipment.id}:${normalizedStep}:${recipientId}`,
      }).catch(() => null);
    }

    return respond(NextResponse.json(result, { status: 201 }));
  } catch (error) {
    if (error instanceof Error && error.message === "CAS_CONFLICT") {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(errorResponse(409, "CONFLICT", "Shipment status changed concurrently. Refresh and retry."));
    }

    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") {
      auditLog({
        correlationId,
        actor,
        action: "gp.statusTransition",
        entity: { type: "GpShipment", id },
        outcome: "CONFLICT",
        reason: AuditReason.NOT_FOUND,
      });
      return respond(errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found."));
    }

    auditLog({
      correlationId,
      actor,
      action: "gp.statusTransition",
      entity: { type: "GpShipment", id },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
