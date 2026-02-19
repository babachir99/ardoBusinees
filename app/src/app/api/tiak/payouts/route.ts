import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function hasTiakPayoutDelegate() {
  const runtimePrisma = prisma as unknown as { tiakPayout?: unknown };
  return Boolean(runtimePrisma.tiakPayout);
}

export async function GET(request: NextRequest) {
  if (!hasTiakPayoutDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "TIAK payout delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (session.user.role !== "COURIER" && session.user.role !== "ADMIN") {
    return errorResponse(403, "FORBIDDEN", "Courier or admin role required.");
  }

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";

  if (!mine && session.user.role !== "ADMIN") {
    return errorResponse(403, "FORBIDDEN", "Use mine=1 unless admin.");
  }

  const take = normalizeTake(searchParams.get("take"), 40, 100);
  const where = mine || session.user.role !== "ADMIN" ? { courierId: session.user.id } : {};

  try {
    const runtimePrisma = prisma as unknown as {
      tiakPayout: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          status: string;
          amountTotalCents: number;
          platformFeeCents: number;
          courierPayoutCents: number;
          currency: string;
          createdAt: Date;
          deliveryId: string;
        }>>;
        aggregate: (args: unknown) => Promise<{ _count?: { _all?: number }; _sum?: { courierPayoutCents?: number | null } }>;
      };
    };

    const [payouts, totals] = await Promise.all([
      runtimePrisma.tiakPayout.findMany({
        where,
        take,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          amountTotalCents: true,
          platformFeeCents: true,
          courierPayoutCents: true,
          currency: true,
          createdAt: true,
          deliveryId: true,
        },
      }),
      runtimePrisma.tiakPayout.aggregate({
        where,
        _count: { _all: true },
        _sum: { courierPayoutCents: true },
      }),
    ]);

    return NextResponse.json({
      payouts,
      meta: {
        count: totals?._count?._all ?? 0,
        sumCourierPayoutCents: totals?._sum?.courierPayoutCents ?? 0,
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}