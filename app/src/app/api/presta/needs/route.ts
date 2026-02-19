import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hasPrestaNeedDelegate() {
  const runtimePrisma = prisma as unknown as { prestaNeed?: unknown };
  return Boolean(runtimePrisma.prestaNeed);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  return rounded >= 0 ? rounded : null;
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function GET(request: NextRequest) {
  if (!hasPrestaNeedDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA needs delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const { searchParams } = new URL(request.url);
  const takeRaw = Number(searchParams.get("take") ?? "20");
  const skipRaw = Number(searchParams.get("skip") ?? "0");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 100) : 20;
  const skip = Number.isFinite(skipRaw) ? Math.max(Math.trunc(skipRaw), 0) : 0;
  const q = normalizeString(searchParams.get("q"));
  const city = normalizeString(searchParams.get("city"));

  const where: Record<string, unknown> = { status: "OPEN" };

  if (city) {
    where.OR = [
      { city: { contains: city, mode: "insensitive" } },
      { area: { contains: city, mode: "insensitive" } },
    ];
  }

  if (q) {
    const qFilters = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { area: { contains: q, mode: "insensitive" } },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR as unknown[] }, { OR: qFilters }];
      delete where.OR;
    } else {
      where.OR = qFilters;
    }
  }

  const needs = await prisma.prestaNeed.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
    skip,
    select: {
      id: true,
      customerId: true,
      storeId: true,
      title: true,
      description: true,
      city: true,
      area: true,
      budgetCents: true,
      currency: true,
      preferredDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  return NextResponse.json(needs);
}

export async function POST(request: NextRequest) {
  if (!hasPrestaNeedDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA needs delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const title = normalizeString((body as { title?: unknown }).title);
  const description = normalizeString((body as { description?: unknown }).description);
  const city = normalizeString((body as { city?: unknown }).city) || null;
  const area = normalizeString((body as { area?: unknown }).area) || null;
  const currency = normalizeString((body as { currency?: unknown }).currency).toUpperCase() || "XOF";
  const budgetCents = parseNullableInt((body as { budgetCents?: unknown }).budgetCents);
  const preferredDateRaw = normalizeString((body as { preferredDate?: unknown }).preferredDate);
  const preferredDate = preferredDateRaw ? new Date(preferredDateRaw) : null;

  if (!title || !description) {
    return errorResponse(400, "VALIDATION_ERROR", "title and description are required.");
  }

  if (preferredDate && Number.isNaN(preferredDate.getTime())) {
    return errorResponse(400, "INVALID_PREFERRED_DATE", "Invalid preferredDate.");
  }

  const prestaStore = await prisma.store.findUnique({
    where: { slug: "jontaado-presta" },
    select: { id: true, isActive: true },
  });

  const created = await prisma.prestaNeed.create({
    data: {
      customerId: session.user.id,
      storeId: prestaStore?.isActive ? prestaStore.id : null,
      title,
      description,
      city,
      area,
      budgetCents,
      currency,
      preferredDate,
      status: "OPEN",
    },
    select: {
      id: true,
      customerId: true,
      storeId: true,
      title: true,
      description: true,
      city: true,
      area: true,
      budgetCents: true,
      currency: true,
      preferredDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  return NextResponse.json(created, { status: 201 });
}
