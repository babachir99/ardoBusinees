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

function hasPrestaPayoutDelegate() {
  const runtimePrisma = prisma as unknown as { prestaPayout?: unknown };
  return Boolean(runtimePrisma.prestaPayout);
}

export async function GET(request: NextRequest) {
  if (!hasPrestaPayoutDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA payout delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";

  if (!mine && session.user.role !== "ADMIN") {
    return errorResponse(403, "FORBIDDEN", "Use mine=1 unless admin.");
  }

  const take = normalizeTake(searchParams.get("take"), 40, 100);

  try {
    const runtimePrisma = prisma as unknown as {
      prestaPayout: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    };

    const payouts = await runtimePrisma.prestaPayout.findMany({
      where: mine ? { providerId: session.user.id } : {},
      take,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        amountTotalCents: true,
        platformFeeCents: true,
        providerPayoutCents: true,
        currency: true,
        createdAt: true,
        bookingId: true,
      },
    });

    return NextResponse.json(payouts);
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
