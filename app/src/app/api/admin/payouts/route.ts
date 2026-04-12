import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, PayoutStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set(Object.values(PayoutStatus));

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseTake(value: string | null) {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(Math.trunc(parsed), 300));
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = normalizeOptionalString(searchParams.get("q"));
  const sellerId = normalizeOptionalString(searchParams.get("sellerId"));
  const statusRaw = normalizeOptionalString(searchParams.get("status"));
  const take = parseTake(searchParams.get("take"));

  const where: Prisma.PayoutWhereInput = {
    ...(sellerId ? { sellerId } : {}),
    ...(statusRaw && allowedStatuses.has(statusRaw as PayoutStatus)
      ? { status: statusRaw as PayoutStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { seller: { displayName: { contains: q, mode: "insensitive" } } },
            { seller: { slug: { contains: q, mode: "insensitive" } } },
            { seller: { user: { email: { contains: q, mode: "insensitive" } } } },
            { orderId: { contains: q, mode: "insensitive" } },
            { providerRef: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, groups, totalCount] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        sellerId: true,
        orderId: true,
        amountCents: true,
        currency: true,
        status: true,
        providerRef: true,
        createdAt: true,
        seller: {
          select: {
            id: true,
            displayName: true,
            slug: true,
            payoutAccountRef: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            totalCents: true,
            currency: true,
            createdAt: true,
            buyerName: true,
            buyerEmail: true,
          },
        },
      },
    }),
    prisma.payout.groupBy({
      by: ["status"],
      where,
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.payout.count({ where }),
  ]);

  const summary = {
    totalCount,
    pendingCount: 0,
    holdCount: 0,
    paidCount: 0,
    failedCount: 0,
    pendingCents: 0,
    holdCents: 0,
    paidCents: 0,
    failedCents: 0,
  };

  for (const row of groups) {
    if (row.status === "PENDING") {
      summary.pendingCount = row._count._all;
      summary.pendingCents = row._sum.amountCents ?? 0;
    }
    if (row.status === "HOLD") {
      summary.holdCount = row._count._all;
      summary.holdCents = row._sum.amountCents ?? 0;
    }
    if (row.status === "PAID") {
      summary.paidCount = row._count._all;
      summary.paidCents = row._sum.amountCents ?? 0;
    }
    if (row.status === "FAILED") {
      summary.failedCount = row._count._all;
      summary.failedCents = row._sum.amountCents ?? 0;
    }
  }

  return NextResponse.json({ items, summary });
}
