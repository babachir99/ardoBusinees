import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { Prisma, StoreType } from "@prisma/client";
import { assertSameOrigin } from "@/lib/request-security";

const allowedStoreTypes = new Set(Object.values(StoreType));

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCategoryIds(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
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
  const typeRaw = normalizeOptionalString(searchParams.get("type"));
  const activeRaw = normalizeOptionalString(searchParams.get("active"));

  const where: Prisma.StoreWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(typeRaw && allowedStoreTypes.has(typeRaw as StoreType)
      ? { type: typeRaw as StoreType }
      : {}),
    ...(activeRaw === "1"
      ? { isActive: true }
      : activeRaw === "0"
      ? { isActive: false }
      : {}),
  };

  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      categories: {
        select: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          category: {
            name: "asc",
          },
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
    take: 200,
  });

  return NextResponse.json(stores);
}

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = normalizeOptionalString(body?.name);
  const description = normalizeOptionalString(body?.description) ?? null;
  const slugInput = normalizeOptionalString(body?.slug);
  const typeRaw = normalizeOptionalString(body?.type) ?? "MARKETPLACE";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;
  const categoryIds = normalizeCategoryIds(body?.categoryIds) ?? [];

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!allowedStoreTypes.has(typeRaw as StoreType)) {
    return NextResponse.json({ error: "Invalid store type" }, { status: 400 });
  }

  const slug = slugify(slugInput ?? name);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  if (categoryIds.length > 0) {
    const existingCategories = await prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (existingCategories !== categoryIds.length) {
      return NextResponse.json({ error: "Some categories do not exist" }, { status: 400 });
    }
  }

  try {
    const created = await prisma.store.create({
      data: {
        name,
        slug,
        type: typeRaw as StoreType,
        description,
        isActive,
        ...(categoryIds.length > 0
          ? {
              categories: {
                create: categoryIds.map((categoryId) => ({
                  category: { connect: { id: categoryId } },
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        isActive: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    throw error;
  }
}
