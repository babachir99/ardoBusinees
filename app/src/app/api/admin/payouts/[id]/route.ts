import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, PayoutStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/request-security";

const allowedStatuses = new Set(Object.values(PayoutStatus));
const activeDisputeStatuses = ["OPEN", "IN_REVIEW"] as const;

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

function isAllowedTransition(current: PayoutStatus, next: PayoutStatus) {
  if (current === next) return true;
  if (current === "PAID") return false;
  if (current === "PENDING") return next === "HOLD" || next === "FAILED" || next === "PAID";
  if (current === "HOLD") return next === "PENDING" || next === "FAILED" || next === "PAID";
  if (current === "FAILED") return next === "PENDING" || next === "HOLD";
  return false;
}

async function hasActiveShopDispute(orderId: string | null | undefined) {
  if (!orderId) return false;
  const runtimePrisma = prisma as unknown as { dispute?: unknown };
  if (!runtimePrisma.dispute) return false;

  const dispute = await prisma.dispute.findFirst({
    where: {
      contextType: "SHOP_ORDER",
      contextId: orderId,
      status: { in: [...activeDisputeStatuses] },
    },
    select: { id: true },
  });

  return Boolean(dispute);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const statusRaw = normalizeOptionalString(body?.status);
  const hasProviderRef = Object.prototype.hasOwnProperty.call(body ?? {}, "providerRef");
  const providerRef = hasProviderRef
    ? normalizeOptionalString(body?.providerRef) ?? null
    : undefined;

  const status = statusRaw ? statusRaw.toUpperCase() : undefined;

  if (status && !allowedStatuses.has(status as PayoutStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (status === undefined && providerRef === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const existing = await prisma.payout.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        status: true,
        providerRef: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    const nextStatus = status ? (status as PayoutStatus) : existing.status;
    const nextProviderRef = providerRef !== undefined ? providerRef : (existing.providerRef ?? null);

    if (status && !isAllowedTransition(existing.status, nextStatus)) {
      return NextResponse.json({ error: "Invalid payout transition" }, { status: 409 });
    }

    if (nextStatus === "PAID" && !String(nextProviderRef ?? "").trim()) {
      return NextResponse.json(
        { error: "providerRef is required before marking payout as paid" },
        { status: 400 }
      );
    }

    if (nextStatus === "PAID" && (await hasActiveShopDispute(existing.orderId))) {
      return NextResponse.json(
        { error: "Active dispute found for this order" },
        { status: 409 }
      );
    }

    const updated = await prisma.payout.update({
      where: { id: existing.id },
      data: {
        ...(status ? { status: nextStatus } : {}),
        ...(providerRef !== undefined ? { providerRef: nextProviderRef } : {}),
      },
      select: {
        id: true,
        status: true,
        providerRef: true,
        amountCents: true,
        currency: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    throw error;
  }
}
