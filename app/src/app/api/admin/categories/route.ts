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

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = normalizeOptionalString(searchParams.get("q"));
  const parentIdRaw = normalizeOptionalString(searchParams.get("parentId"));
  const activeRaw = normalizeOptionalString(searchParams.get("active"));

  const where: Prisma.CategoryWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(parentIdRaw
      ? parentIdRaw === "root"
        ? { parentId: null }
        : { parentId: parentIdRaw }
      : {}),
    ...(activeRaw === "1"
      ? { isActive: true }
      : activeRaw === "0"
      ? { isActive: false }
      : {}),
  };

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      parent: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          children: true,
          products: true,
          stores: true,
        },
      },
    },
    take: 500,
  });

  return NextResponse.json(categories);
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
  const parentId = normalizeOptionalString(body?.parentId) ?? null;
  const description = normalizeOptionalString(body?.description) ?? null;
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;
  const slugInput = normalizeOptionalString(body?.slug);

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = slugify(slugInput ?? name);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
    }
  }

  try {
    const created = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        parentId,
        isActive,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        isActive: true,
        createdAt: true,
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
