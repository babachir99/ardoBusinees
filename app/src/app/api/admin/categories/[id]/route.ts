import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { Prisma } from "@prisma/client";
import { assertSameOrigin } from "@/lib/request-security";

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

async function createsParentCycle(id: string, parentId: string) {
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === id) return true;
    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!parent) return false;
    cursor = parent.parentId;
  }
  return false;
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
  const description =
    typeof body?.description === "string" ? body.description.trim() : undefined;
  const hasParentId = Object.prototype.hasOwnProperty.call(body ?? {}, "parentId");
  const parentId = hasParentId ? normalizeOptionalString(body?.parentId) ?? null : undefined;
  const isActive =
    typeof body?.isActive === "boolean" ? body.isActive : undefined;

  if (
    name === undefined &&
    slugInput === undefined &&
    description === undefined &&
    parentId === undefined &&
    isActive === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (parentId === id) {
    return NextResponse.json({ error: "Category cannot be its own parent" }, { status: 400 });
  }

  if (parentId) {
    const parent: { id: string } | null = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
    }
    const hasCycle = await createsParentCycle(id, parentId);
    if (hasCycle) {
      return NextResponse.json({ error: "Invalid parent (cycle detected)" }, { status: 400 });
    }
  }

  const slug = slugInput ? slugify(slugInput) : undefined;
  if (slugInput && !slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(parentId !== undefined ? { parentId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        isActive: true,
        updatedAt: true,
      },
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
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
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

  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          children: true,
          products: true,
          stores: true,
        },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (
    category._count.children > 0 ||
    category._count.products > 0 ||
    category._count.stores > 0
  ) {
    return NextResponse.json(
      { error: "Cannot delete category with subcategories, products, or store links" },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}



