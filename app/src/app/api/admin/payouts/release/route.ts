import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  DisputeContextType,
  PrestaPayoutStatus,
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

async function hasActiveDispute(
  contexts: Array<{ contextType: DisputeContextType; contextId: string }>
) {
  if (!hasDisputeDelegate()) {
    // TODO: add hard guard when dispute model is always available in all environments.
    return false;
  }

  const cleanedContexts = contexts
    .map((entry) => ({
      contextType: entry.contextType,
      contextId: entry.contextId.trim(),
    }))
    .filter((entry) => entry.contextType.length > 0 && entry.contextId.length > 0);

  if (cleanedContexts.length === 0) {
    return false;
  }

  const dispute = await prisma.dispute.findFirst({
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
    const payout = await prisma.prestaPayout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        status: true,
        bookingId: true,
        booking: {
          select: {
            id: true,
            orderId: true,
          },
        },
      },
    });

    if (!payout) {
      return errorResponse(404, "PAYOUT_NOT_FOUND", "PRESTA payout not found.");
    }

    if (payout.status === PrestaPayoutStatus.PAID) {
      return NextResponse.json({ payout: { id: payout.id, status: payout.status } });
    }

    if (payout.status !== PrestaPayoutStatus.READY) {
      return errorResponse(409, "INVALID_PAYOUT_STATE", "Payout must be READY before release.");
    }

    const blocked = await hasActiveDispute([
      { contextType: DisputeContextType.PRESTA_BOOKING, contextId: payout.bookingId },
      {
        contextType: DisputeContextType.SHOP_ORDER,
        contextId: payout.booking?.orderId ?? "",
      },
    ]);

    if (blocked) {
      return errorResponse(409, "PAYOUT_BLOCKED_BY_DISPUTE", "Active dispute found for this transaction.");
    }

    const updated = await prisma.prestaPayout.update({
      where: { id: payout.id },
      data: { status: PrestaPayoutStatus.PAID },
      select: { id: true, status: true },
    });

    await logRelease(session.user.id, "PRESTA", updated.id);

    return NextResponse.json({ payout: updated });
  }

  const payout = await prisma.tiakPayout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      status: true,
      deliveryId: true,
      delivery: {
        select: {
          id: true,
          orderId: true,
        },
      },
    },
  });

  if (!payout) {
    return errorResponse(404, "PAYOUT_NOT_FOUND", "TIAK payout not found.");
  }

  if (payout.status === TiakPayoutStatus.PAID) {
    return NextResponse.json({ payout: { id: payout.id, status: payout.status } });
  }

  if (payout.status !== TiakPayoutStatus.READY) {
    return errorResponse(409, "INVALID_PAYOUT_STATE", "Payout must be READY before release.");
  }

  const blocked = await hasActiveDispute([
    { contextType: DisputeContextType.TIAK_DELIVERY, contextId: payout.deliveryId },
    {
      contextType: DisputeContextType.SHOP_ORDER,
      contextId: payout.delivery?.orderId ?? "",
    },
  ]);

  if (blocked) {
    return errorResponse(409, "PAYOUT_BLOCKED_BY_DISPUTE", "Active dispute found for this transaction.");
  }

  const updated = await prisma.tiakPayout.update({
    where: { id: payout.id },
    data: { status: TiakPayoutStatus.PAID },
    select: { id: true, status: true },
  });

  await logRelease(session.user.id, "TIAK", updated.id);

  return NextResponse.json({ payout: updated });
}