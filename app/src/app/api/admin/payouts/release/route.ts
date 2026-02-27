import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  DisputeContextType,
  PrestaPayoutStatus,
  Prisma,
  TiakPayoutStatus,
} from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/request-security";
import { hasUserRole } from "@/lib/userRoles";

type ReleaseType = "PRESTA" | "TIAK";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function parseType(value: unknown): ReleaseType | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "PRESTA" || normalized === "TIAK") {
    return normalized as ReleaseType;
  }
  return null;
}

function hasPayoutDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaPayout?: unknown;
    tiakPayout?: unknown;
  };
  return Boolean(runtimePrisma.prestaPayout && runtimePrisma.tiakPayout);
}

function hasDisputeDelegate() {
  const runtimePrisma = prisma as unknown as { dispute?: unknown };
  return Boolean(runtimePrisma.dispute);
}

function hasActivityLogDelegate() {
  const runtimePrisma = prisma as unknown as { activityLog?: unknown };
  return Boolean(runtimePrisma.activityLog);
}

async function hasActiveDisputeInTx(
  tx: Prisma.TransactionClient,
  contexts: Array<{ contextType: DisputeContextType; contextId: string }>
) {
  const cleanedContexts = contexts
    .map((entry) => ({
      contextType: entry.contextType,
      contextId: entry.contextId.trim(),
    }))
    .filter((entry) => entry.contextType.length > 0 && entry.contextId.length > 0);

  if (cleanedContexts.length === 0) {
    return false;
  }

  const dispute = await tx.dispute.findFirst({
    where: {
      status: { in: ["OPEN", "IN_REVIEW"] },
      OR: cleanedContexts.map((entry) => ({
        contextType: entry.contextType,
        contextId: entry.contextId,
      })),
    },
    select: { id: true },
  });

  return Boolean(dispute);
}

async function logRelease(userId: string, type: ReleaseType, payoutId: string) {
  if (!hasActivityLogDelegate()) return;
  await prisma.activityLog.create({
    data: {
      userId,
      action: "PAYOUT_RELEASED",
      entityType: type,
      entityId: payoutId,
      metadata: { type, payoutId },
    },
  });
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "payout.release";

  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return respond(csrfBlocked);

  if (!hasPayoutDelegates()) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "Payout" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(
      errorResponse(
        503,
        "DELEGATE_UNAVAILABLE",
        "Payout delegates unavailable. Run npx prisma generate and restart dev server."
      )
    );
  }

  if (!hasDisputeDelegate()) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "Payout" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(
      errorResponse(
        503,
        "DELEGATE_UNAVAILABLE",
        "Dispute delegate unavailable. Run npx prisma generate and restart dev server."
      )
    );
  }

  const session = await getServerSession(authOptions);
  const actor = { userId: session?.user?.id ?? null, role: session?.user?.role ?? null };
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payout" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Admin access required."));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payout" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_BODY", "JSON body is required."));
  }

  const type = parseType((body as { type?: unknown }).type);
  const payoutId =
    typeof (body as { payoutId?: unknown }).payoutId === "string"
      ? (body as { payoutId: string }).payoutId.trim()
      : "";

  if (!type || !payoutId) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payout", id: payoutId || null },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_INPUT", "type and payoutId are required."));
  }

  if (type === "PRESTA") {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const payout = await tx.prestaPayout.findUnique({
            where: { id: payoutId },
            select: {
              id: true,
              status: true,
              bookingId: true,
              booking: {
                select: {
                  orderId: true,
                },
              },
            },
          });

          if (!payout) {
            throw new Error("PAYOUT_NOT_FOUND");
          }

          if (payout.status === PrestaPayoutStatus.PAID) {
            return {
              payout: { id: payout.id, status: payout.status },
              released: false,
            };
          }

          if (payout.status !== PrestaPayoutStatus.READY) {
            throw new Error("INVALID_PAYOUT_STATE");
          }

          const blocked = await hasActiveDisputeInTx(tx, [
            { contextType: DisputeContextType.PRESTA_BOOKING, contextId: payout.bookingId },
            {
              contextType: DisputeContextType.SHOP_ORDER,
              contextId: payout.booking?.orderId ?? "",
            },
          ]);

          if (blocked) {
            throw new Error("PAYOUT_BLOCKED_BY_DISPUTE");
          }

          const updated = await tx.prestaPayout.updateMany({
            where: {
              id: payout.id,
              status: PrestaPayoutStatus.READY,
            },
            data: { status: PrestaPayoutStatus.PAID },
          });

          if (updated.count === 0) {
            throw new Error("INVALID_PAYOUT_STATE");
          }

          const finalPayout = await tx.prestaPayout.findUnique({
            where: { id: payout.id },
            select: { id: true, status: true },
          });

          if (!finalPayout) {
            throw new Error("PAYOUT_NOT_FOUND");
          }

          return {
            payout: finalPayout,
            released: true,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      if (result.released) {
        await logRelease(session.user.id, "PRESTA", result.payout.id);
      }

      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "PrestaPayout", id: result.payout.id },
        outcome: "SUCCESS",
        reason: AuditReason.SUCCESS,
        metadata: { type, status: result.payout.status },
      });

      return respond(NextResponse.json({ payout: result.payout }));
    } catch (error) {
      if (error instanceof Error && error.message === "PAYOUT_NOT_FOUND") {
        auditLog({
          correlationId,
          actor,
          action,
          entity: { type: "PrestaPayout", id: payoutId },
          outcome: "CONFLICT",
          reason: AuditReason.NOT_FOUND,
        });
        return respond(errorResponse(404, "PAYOUT_NOT_FOUND", "PRESTA payout not found."));
      }

      if (error instanceof Error && error.message === "INVALID_PAYOUT_STATE") {
        auditLog({
          correlationId,
          actor,
          action,
          entity: { type: "PrestaPayout", id: payoutId },
          outcome: "CONFLICT",
          reason: AuditReason.STATE_CONFLICT,
        });
        return respond(errorResponse(409, "INVALID_PAYOUT_STATE", "Payout must be READY before release."));
      }

      if (error instanceof Error && error.message === "PAYOUT_BLOCKED_BY_DISPUTE") {
        auditLog({
          correlationId,
          actor,
          action,
          entity: { type: "PrestaPayout", id: payoutId },
          outcome: "DENIED",
          reason: AuditReason.ACTIVE_DISPUTE,
        });
        return respond(errorResponse(409, "PAYOUT_BLOCKED_BY_DISPUTE", "Active dispute found for this transaction."));
      }

      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "PrestaPayout", id: payoutId },
        outcome: "ERROR",
        reason: AuditReason.DB_ERROR,
      });
      return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
    }
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const payout = await tx.tiakPayout.findUnique({
          where: { id: payoutId },
          select: {
            id: true,
            status: true,
            deliveryId: true,
            delivery: {
              select: {
                orderId: true,
              },
            },
          },
        });

        if (!payout) {
          throw new Error("PAYOUT_NOT_FOUND");
        }

        if (payout.status === TiakPayoutStatus.PAID) {
          return {
            payout: { id: payout.id, status: payout.status },
            released: false,
          };
        }

        if (payout.status !== TiakPayoutStatus.READY) {
          throw new Error("INVALID_PAYOUT_STATE");
        }

        const blocked = await hasActiveDisputeInTx(tx, [
          { contextType: DisputeContextType.TIAK_DELIVERY, contextId: payout.deliveryId },
          {
            contextType: DisputeContextType.SHOP_ORDER,
            contextId: payout.delivery?.orderId ?? "",
          },
        ]);

        if (blocked) {
          throw new Error("PAYOUT_BLOCKED_BY_DISPUTE");
        }

        const updated = await tx.tiakPayout.updateMany({
          where: {
            id: payout.id,
            status: TiakPayoutStatus.READY,
          },
          data: { status: TiakPayoutStatus.PAID },
        });

        if (updated.count === 0) {
          throw new Error("INVALID_PAYOUT_STATE");
        }

        const finalPayout = await tx.tiakPayout.findUnique({
          where: { id: payout.id },
          select: { id: true, status: true },
        });

        if (!finalPayout) {
          throw new Error("PAYOUT_NOT_FOUND");
        }

        return {
          payout: finalPayout,
          released: true,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    if (result.released) {
      await logRelease(session.user.id, "TIAK", result.payout.id);
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakPayout", id: result.payout.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { type, status: result.payout.status },
    });

    return respond(NextResponse.json({ payout: result.payout }));
  } catch (error) {
    if (error instanceof Error && error.message === "PAYOUT_NOT_FOUND") {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakPayout", id: payoutId },
        outcome: "CONFLICT",
        reason: AuditReason.NOT_FOUND,
      });
      return respond(errorResponse(404, "PAYOUT_NOT_FOUND", "TIAK payout not found."));
    }

    if (error instanceof Error && error.message === "INVALID_PAYOUT_STATE") {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakPayout", id: payoutId },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(errorResponse(409, "INVALID_PAYOUT_STATE", "Payout must be READY before release."));
    }

    if (error instanceof Error && error.message === "PAYOUT_BLOCKED_BY_DISPUTE") {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "TiakPayout", id: payoutId },
        outcome: "DENIED",
        reason: AuditReason.ACTIVE_DISPUTE,
      });
      return respond(errorResponse(409, "PAYOUT_BLOCKED_BY_DISPUTE", "Active dispute found for this transaction."));
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "TiakPayout", id: payoutId },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
