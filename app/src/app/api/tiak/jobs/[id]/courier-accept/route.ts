import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "tiak.accept";

  const runtimePrisma = prisma as unknown as { tiakDelivery?: unknown };
  if (!runtimePrisma.tiakDelivery) {
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

  const { id } = await params;

  try {
    const job = await prisma.tiakDelivery.findUnique({
      where: { id },
      select: {
        id: true,
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
    const isAssignedCourier = session.user.id === job.courierId;
    if (!isAdmin && !isAssignedCourier) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
      });
      return respond(errorResponse(403, "FORBIDDEN", "Only assigned courier or admin can accept."));
    }

    const expectedCourierId = isAdmin ? job.courierId : session.user.id;
    if (!expectedCourierId) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(errorResponse(409, "JOB_NOT_ASSIGNED", "Job has no assigned courier."));
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const expired = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "ASSIGNED",
          courierId: expectedCourierId,
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

        return { state: "expired" as const };
      }

      const accepted = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "ASSIGNED",
          courierId: expectedCourierId,
          assignExpiresAt: { gt: now },
        },
        data: {
          assignExpiresAt: null,
        },
      });

      if (accepted.count === 0) {
        return { state: "conflict" as const };
      }

      await tx.tiakDeliveryEvent.create({
        data: {
          deliveryId: job.id,
          status: "ACCEPTED",
          note: "Courier accepted assignment",
          actorId: session.user.id,
        },
      });

      return { state: "accepted" as const };
    });

    if (result.state === "expired") {
      auditLog({
        correlationId,
        actor,
        action: "tiak.expire",
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "SUCCESS",
        reason: AuditReason.ASSIGNMENT_EXPIRED,
      });
      return respond(errorResponse(409, "ASSIGNMENT_EXPIRED", "Assignment has expired."));
    }

    if (result.state === "conflict") {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakDelivery", id: job.id },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(errorResponse(409, "JOB_NOT_OPEN", "Job is no longer assignable."));
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakDelivery", id: job.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
    });

    return respond(
      NextResponse.json({
        job: {
          id: job.id,
          status: "ACCEPTED",
        },
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
