import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";

const vertical = Vertical.PRESTA;
const rules = getVerticalRules(vertical);

function hasMatchingDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaNeed?: unknown;
    prestaProposal?: unknown;
  };

  return Boolean(runtimePrisma.prestaNeed && runtimePrisma.prestaProposal);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function truncate(value: string | null, maxLength: number) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

// curl -X GET "http://localhost:3000/api/presta/matching/needs?take=24" -H "Cookie: next-auth.session-token=..."
// curl -X GET "http://localhost:3000/api/presta/matching/needs?city=Dakar&q=plomberie" -H "Cookie: next-auth.session-token=..."
export async function GET(request: NextRequest) {
  if (!hasMatchingDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA matching delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const allowedRoles = new Set(rules.publishRoles);
  if (!allowedRoles.has(session.user.role as (typeof rules.publishRoles)[number])) {
    return errorResponse(403, "FORBIDDEN", "Role is not allowed to access PRESTA need matching.");
  }

  const { searchParams } = new URL(request.url);
  const take = normalizeTake(searchParams.get("take"), 24, 60);
  const city = normalizeString(searchParams.get("city"));
  const area = normalizeString(searchParams.get("area"));
  const q = normalizeString(searchParams.get("q"));

  const where: Record<string, unknown> = { status: "OPEN" };

  if (city) {
    where.city = { contains: city, mode: "insensitive" };
  }

  if (area) {
    where.area = { contains: area, mode: "insensitive" };
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const needs = await prisma.prestaNeed.findMany({
    where,
    take,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      area: true,
      budgetCents: true,
      currency: true,
      preferredDate: true,
      createdAt: true,
      status: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  const needIds = needs.map((need) => need.id);
  const proposed = needIds.length
    ? await prisma.prestaProposal.findMany({
        where: {
          providerId: session.user.id,
          needId: { in: needIds },
        },
        select: { needId: true },
      })
    : [];

  const proposedNeedIds = new Set(proposed.map((proposal) => proposal.needId));

  return NextResponse.json(
    needs.map((need) => ({
      need: {
        id: need.id,
        title: need.title,
        description: truncate(need.description, 240),
        city: need.city,
        area: need.area,
        budgetCents: need.budgetCents,
        currency: need.currency,
        preferredDate: need.preferredDate,
        createdAt: need.createdAt,
        status: need.status,
      },
      customer: {
        id: need.customer.id,
        name: need.customer.name,
        image: need.customer.image,
      },
      alreadyProposed: proposedNeedIds.has(need.id),
    }))
  );
}

