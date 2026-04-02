import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { recordGpThreadRead } from "@/lib/messages/gpThreadRead";
import { decodeHistoryCursor, encodeHistoryCursor, parseThreadTake } from "@/lib/messages/history";
import { getPresenceForUser, serializePresence } from "@/lib/messages/presence";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { normalizeDeliveryStep } from "@/lib/notifications/delivery-step";

const orderedStatuses = ["DROPPED_OFF", "PICKED_UP", "BOARDED", "ARRIVED", "DELIVERED"] as const;
const bookingStatusByShipmentStatus = {
  PICKED_UP: "CONFIRMED",
  BOARDED: "CONFIRMED",
  ARRIVED: "COMPLETED",
  DELIVERED: "COMPLETED",
} as const;

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

function summarizeThreadMessage(params: {
  note: string | null;
  proofUrl: string | null;
  proofType: string | null;
}) {
  const { note, proofUrl, proofType } = params;
  if (note) {
    return note.replace(/\s+/g, " ").trim().slice(0, 180);
  }
  if (proofUrl) {
    return proofType?.startsWith("image/") ? "Photo partagee." : "Piece jointe partagee.";
  }
  return "Nouveau message.";
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
        bookingId: string | null;
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
        bookingId: true,
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
  const beforeCursor = decodeHistoryCursor(request.nextUrl.searchParams.get("before"));
  const paginated =
    request.nextUrl.searchParams.has("take") || request.nextUrl.searchParams.has("before");
  const take = parseThreadTake(request.nextUrl.searchParams.get("take"));

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

    await recordGpThreadRead(session.user.id, loaded.shipment.id).catch(() => null);

    const shipmentDetails = await prisma.gpShipment.findUnique({
      where: { id: loaded.shipment.id },
      select: {
        id: true,
        code: true,
        status: true,
        fromCity: true,
        toCity: true,
        weightKg: true,
        senderId: true,
        receiverId: true,
        transporterId: true,
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
        receiver: {
          select: { id: true, name: true, email: true, image: true },
        },
        transporter: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    const events = await runtimePrisma.gpShipmentEvent.findMany({
      where: {
        shipmentId: loaded.shipment.id,
        ...(beforeCursor
          ? {
              OR: [
                { createdAt: { lt: beforeCursor.createdAt } },
                {
                  AND: [{ createdAt: beforeCursor.createdAt }, { id: { lt: beforeCursor.id } }],
                },
              ],
            }
          : {}),
      },
      orderBy: paginated ? [{ createdAt: "desc" }, { id: "desc" }] : [{ createdAt: "asc" }],
      take: paginated ? take + 1 : undefined,
      select: {
        id: true,
        status: true,
        createdAt: true,
        note: true,
        proofUrl: true,
        proofType: true,
        actorId: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    const slicedEvents = paginated ? events.slice(0, take) : events;
    const normalizedEvents = paginated ? [...slicedEvents].reverse() : slicedEvents;
    const oldestLoaded =
      paginated && slicedEvents.length > 0
        ? (slicedEvents[slicedEvents.length - 1] as { id: string; createdAt: Date })
        : null;
    const counterpartId =
      loaded.shipment.transporterId === session.user.id
        ? loaded.shipment.senderId ?? loaded.shipment.receiverId ?? null
        : loaded.shipment.transporterId;
    const counterpartPresence = serializePresence(await getPresenceForUser(counterpartId));

    return respond(
      NextResponse.json({
        shipment: {
          id: shipmentDetails?.id ?? loaded.shipment.id,
          code: shipmentDetails?.code ?? loaded.shipment.code,
          status: shipmentDetails?.status ?? loaded.shipment.status,
          fromCity: shipmentDetails?.fromCity ?? null,
          toCity: shipmentDetails?.toCity ?? null,
          weightKg: shipmentDetails?.weightKg ?? null,
          senderId: shipmentDetails?.senderId ?? loaded.shipment.senderId,
          receiverId: shipmentDetails?.receiverId ?? loaded.shipment.receiverId,
          transporterId: shipmentDetails?.transporterId ?? loaded.shipment.transporterId,
          sender: shipmentDetails?.sender ?? null,
          receiver: shipmentDetails?.receiver ?? null,
          transporter: shipmentDetails?.transporter ?? null,
        },
        counterpart: counterpartId
          ? {
              id: counterpartId,
              name:
                loaded.shipment.transporterId === session.user.id
                  ? shipmentDetails?.sender?.name || shipmentDetails?.sender?.email || shipmentDetails?.receiver?.name || shipmentDetails?.receiver?.email || null
                  : shipmentDetails?.transporter?.name || shipmentDetails?.transporter?.email || null,
              email:
                loaded.shipment.transporterId === session.user.id
                  ? shipmentDetails?.sender?.email ?? shipmentDetails?.receiver?.email ?? null
                  : shipmentDetails?.transporter?.email ?? null,
              image:
                loaded.shipment.transporterId === session.user.id
                  ? shipmentDetails?.sender?.image ?? shipmentDetails?.receiver?.image ?? null
                  : shipmentDetails?.transporter?.image ?? null,
            }
          : null,
        presence: counterpartPresence,
        pagination: paginated
          ? {
              hasMore: events.length > take,
              nextCursor:
                events.length > take && oldestLoaded
                  ? encodeHistoryCursor({ id: oldestLoaded.id, createdAt: oldestLoaded.createdAt })
                  : null,
              take,
            }
          : null,
        events: normalizedEvents,
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

  const wantsStatusTransition = requestedStatus.length > 0;

  if (!wantsStatusTransition && !note && !parsedProof.value) {
    auditLog({
      correlationId,
      actor,
      action: "gp.timelineMessage",
      entity: { type: "GpShipment", id },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "EMPTY_MESSAGE", "Provide a note or attachment."));
  }

  if (wantsStatusTransition && !parsedProof.value) {
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

  if (
    wantsStatusTransition &&
    !orderedStatuses.includes(requestedStatus as (typeof orderedStatuses)[number])
  ) {
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

    if (!wantsStatusTransition) {
      if (!canReadTimeline({ role: session.user.role, userId: session.user.id, shipment: loaded.shipment })) {
        auditLog({
          correlationId,
          actor,
          action: "gp.timelineMessage",
          entity: { type: "GpShipment", id: loaded.shipment.id },
          outcome: "DENIED",
          reason: AuditReason.FORBIDDEN,
        });
        return respond(errorResponse(403, "FORBIDDEN", "Only shipment participants can post messages."));
      }

      const event = await prisma.gpShipmentEvent.create({
        data: {
          shipmentId: loaded.shipment.id,
          status: loaded.shipment.status as (typeof orderedStatuses)[number],
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

      auditLog({
        correlationId,
        actor,
        action: "gp.timelineMessage",
        entity: { type: "GpShipmentEvent", id: event.id },
        outcome: "SUCCESS",
        reason: AuditReason.SUCCESS,
        metadata: { shipmentId: loaded.shipment.id, status: event.status },
      });

      const recipientIds = Array.from(
        new Set(
          [loaded.shipment.senderId, loaded.shipment.receiverId, loaded.shipment.transporterId].filter(
            (value): value is string => Boolean(value) && value !== session.user.id
          )
        )
      );
      const actorName =
        session.user.name?.trim() ||
        session.user.email?.trim() ||
        (session.user.role === "ADMIN" ? "Admin JONTAADO" : "Un participant");
      const messagePreview = summarizeThreadMessage({
        note,
        proofUrl: parsedProof.value,
        proofType,
      });

      for (const recipientId of recipientIds) {
        await NotificationService.queueEmail({
          userId: recipientId,
          kind: "TRANSACTIONAL",
          templateKey: "gp_thread_message",
          payload: {
            shipmentCode: loaded.shipment.code,
            actorName,
            messagePreview,
            link: `/messages?thread=gp:${loaded.shipment.id}&service=GP`,
          },
          dedupeKey: `gp_thread_message:${loaded.shipment.id}:${event.id}:${recipientId}`,
        }).catch(() => null);
      }

      return respond(
        NextResponse.json(
          {
            mode: "comment",
            shipment: {
              id: loaded.shipment.id,
              code: loaded.shipment.code,
              status: loaded.shipment.status,
            },
            event,
          },
          { status: 201 }
        )
      );
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
          findUnique: (args: unknown) => Promise<{ id: string; code: string; status: string; bookingId: string | null } | null>;
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
        gpTripBooking?: {
          update: (args: unknown) => Promise<unknown>;
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
        select: { id: true, code: true, status: true, bookingId: true },
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

      const mappedBookingStatus =
        bookingStatusByShipmentStatus[
          requestedStatus as keyof typeof bookingStatusByShipmentStatus
        ];

      if (mappedBookingStatus && shipment.bookingId && txRuntime.gpTripBooking) {
        await txRuntime.gpTripBooking.update({
          where: { id: shipment.bookingId },
          data: {
            status: mappedBookingStatus,
            confirmedAt:
              mappedBookingStatus === "CONFIRMED" || mappedBookingStatus === "COMPLETED"
                ? new Date()
                : undefined,
            completedAt: mappedBookingStatus === "COMPLETED" ? new Date() : undefined,
          },
        });
      }

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
