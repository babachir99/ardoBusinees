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
      status: "OPEN",
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
  if (!hasPayoutDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Payout delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  if (!hasDisputeDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Dispute delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "JSON body is required.");
  }

  const type = parseType((body as { type?: unknown }).type);
  const payoutId =
    typeof (body as { payoutId?: unknown }).payoutId === "string"
      ? (body as { payoutId: string }).payoutId.trim()
      : "";

  if (!type || !payoutId) {
    return errorResponse(400, "INVALID_INPUT", "type and payoutId are required.");
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

      return NextResponse.json({ payout: result.payout });
    } catch (error) {
      if (error instanceof Error && error.message === "PAYOUT_NOT_FOUND") {
        return errorResponse(404, "PAYOUT_NOT_FOUND", "PRESTA payout not found.");
      }

      if (error instanceof Error && error.message === "INVALID_PAYOUT_STATE") {
        return errorResponse(409, "INVALID_PAYOUT_STATE", "Payout must be READY before release.");
      }

      if (error instanceof Error && error.message === "PAYOUT_BLOCKED_BY_DISPUTE") {
        return errorResponse(409, "PAYOUT_BLOCKED_BY_DISPUTE", "Active dispute found for this transaction.");
      }

      return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
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

    return NextResponse.json({ payout: result.payout });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYOUT_NOT_FOUND") {
      return errorResponse(404, "PAYOUT_NOT_FOUND", "TIAK payout not found.");
    }

    if (error instanceof Error && error.message === "INVALID_PAYOUT_STATE") {
      return errorResponse(409, "INVALID_PAYOUT_STATE", "Payout must be READY before release.");
    }

    if (error instanceof Error && error.message === "PAYOUT_BLOCKED_BY_DISPUTE") {
      return errorResponse(409, "PAYOUT_BLOCKED_BY_DISPUTE", "Active dispute found for this transaction.");
    }

    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}