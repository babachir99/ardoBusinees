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

  const name = normalizeOptionalString(body?.name);
  const slugInput = normalizeOptionalString(body?.slug);
  const typeRaw = normalizeOptionalString(body?.type);
  const description =
    typeof body?.description === "string" ? body.description.trim() : undefined;
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : undefined;
  const categoryIds = normalizeCategoryIds(body?.categoryIds);

  if (
    name === undefined &&
    slugInput === undefined &&
    typeRaw === undefined &&
    description === undefined &&
    isActive === undefined &&
    categoryIds === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (typeRaw && !allowedStoreTypes.has(typeRaw as StoreType)) {
    return NextResponse.json({ error: "Invalid store type" }, { status: 400 });
  }

  if (categoryIds) {
    const existingCategories = await prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (existingCategories !== categoryIds.length) {
      return NextResponse.json({ error: "Some categories do not exist" }, { status: 400 });
    }
  }

  const slug = slugInput ? slugify(slugInput) : undefined;
  if (slugInput && !slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const store = await tx.store.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(typeRaw !== undefined ? { type: typeRaw as StoreType } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          description: true,
          isActive: true,
          updatedAt: true,
        },
      });

      if (categoryIds !== undefined) {
        await tx.storeCategory.deleteMany({ where: { storeId: id } });
        if (categoryIds.length > 0) {
          await tx.storeCategory.createMany({
            data: categoryIds.map((categoryId) => ({ storeId: id, categoryId })),
            skipDuplicates: true,
          });
        }
      }

      return store;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(_request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (store._count.products > 0) {
    return NextResponse.json(
      { error: "Cannot delete a store with linked products" },
      { status: 409 }
    );
  }

  await prisma.store.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
