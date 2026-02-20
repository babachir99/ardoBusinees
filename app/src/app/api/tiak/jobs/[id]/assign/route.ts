import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeCourierId(value: unknown) {
  return String(value ?? "").trim();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "tiak.assign";

  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: unknown;
    tiakCourierProfile?: unknown;
  };

  if (!runtimePrisma.tiakDelivery || !runtimePrisma.tiakCourierProfile) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "TiakDelivery" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate"));
  }

  const session = await getServerSession(authOptions);
  const actor = { userId: session?.user?.id ?? null, role: session?.user?.role ?? null };
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakDelivery" },
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
      entity: { type: "TiakDelivery" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_BODY", "Invalid JSON body."));
  }

  const courierId = normalizeCourierId((body as { courierId?: unknown }).courierId);
  if (!courierId) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakDelivery" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "COURIER_ID_REQUIRED", "courierId is required."));
  }

  const { id } = await params;

  try {
    const job = await prisma.tiakDelivery.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        courierId: true,
        assignExpiresAt: true,
      },
    });

    if (!job) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakDelivery", id },
        outcome: "CONFLICT",
        reason: AuditReason.NOT_FOUND,
      });
      return respond(errorResponse(404, "JOB_NOT_FOUND", "Tiak job not found."));
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = session.user.id === job.customerId;

    if (!isAdmin && !isOwner) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
      });
      return respond(errorResponse(403, "FORBIDDEN", "Only owner or admin can assign courier."));
    }

    const courier = await prisma.tiakCourierProfile.findFirst({
      where: {
        courierId,
        isActive: true,
      },
      select: {
        courierId: true,
        courier: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!courier) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakCourierProfile", id: courierId },
        outcome: "CONFLICT",
        reason: AuditReason.NOT_FOUND,
      });
      return respond(errorResponse(404, "COURIER_NOT_FOUND", "Courier profile not found or inactive."));
    }

    const assignedAt = new Date();
    const assignExpiresAt = addMinutes(assignedAt, 5);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const expired = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
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

      if (expired.count > 0) {
        await tx.tiakDeliveryEvent.create({
          data: {
            deliveryId: job.id,
            status: "REQUESTED",
            note: "Assignment expired",
            actorId: session.user.id,
          },
        });
      }

      const updated = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "REQUESTED",
          courierId: null,
        },
        data: {
          status: "ASSIGNED",
          courierId: courier.courierId,
          assignedAt,
          assignExpiresAt,
        },
      });

      if (updated.count === 0) {
        return { updated: false as const, expiredCount: expired.count };
      }

      await tx.tiakDeliveryEvent.create({
        data: {
          deliveryId: job.id,
          status: "ASSIGNED",
          note: "Courier assigned",
          actorId: session.user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: courier.courierId,
          action: "TIAK_JOB_ASSIGNED",
          entityType: "TiakDelivery",
          entityId: job.id,
          metadata: {
            assignedById: session.user.id,
            assignExpiresAt,
          },
        },
      });

      return { updated: true as const, expiredCount: expired.count };
    });

    if (result.expiredCount > 0) {
      auditLog({
        correlationId,
        actor,
        action: "tiak.expire",
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "SUCCESS",
        reason: AuditReason.ASSIGNMENT_EXPIRED,
      });
    }

    if (!result.updated) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(errorResponse(409, "JOB_NOT_OPEN", "Job is no longer open for assignment."));
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakDelivery", id: job.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        courierId: courier.courierId,
      },
    });

    return respond(
      NextResponse.json({
        job: {
          id: job.id,
          status: "ASSIGNED",
          assignedCourierId: courier.courierId,
          assignExpiresAt,
        },
        courier: courier.courier,
      })
    );
  } catch {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakDelivery", id },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
