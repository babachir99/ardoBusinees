import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hasPrestaProposalDelegate() {
  const runtimePrisma = prisma as unknown as { prestaProposal?: unknown };
  return Boolean(runtimePrisma.prestaProposal);
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

// curl -X GET "http://localhost:3000/api/presta/proposals?mine=1" -H "Cookie: next-auth.session-token=..."
export async function GET(request: NextRequest) {
  if (!hasPrestaProposalDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA proposal delegate unavailable. Run npx prisma generate and restart dev server."
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

  const where = mine
    ? { providerId: session.user.id }
    : session.user.role === "ADMIN"
      ? {}
      : { providerId: session.user.id };

  const proposals = await prisma.prestaProposal.findMany({
    where,
    take,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      needId: true,
      serviceId: true,
      providerId: true,
      bookingId: true,
      status: true,
      message: true,
      createdAt: true,
      updatedAt: true,
      need: {
        select: {
          id: true,
          title: true,
          status: true,
          city: true,
          area: true,
          customer: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      service: {
        select: {
          id: true,
          title: true,
          basePriceCents: true,
          currency: true,
          city: true,
        },
      },
      booking: {
        select: {
          id: true,
          status: true,
          orderId: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json(proposals);
}

