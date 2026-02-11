import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { Prisma, SellerStatus, UserRole } from "@prisma/client";

const allowedSellerStatuses = new Set(Object.values(SellerStatus));

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
  const statusRaw = normalizeOptionalString(searchParams.get("status"));
  const activeRaw = normalizeOptionalString(searchParams.get("active"));

  const where: Prisma.SellerProfileWhereInput = {
    ...(statusRaw && allowedSellerStatuses.has(statusRaw as SellerStatus)
      ? { status: statusRaw as SellerStatus }
      : {}),
    ...(activeRaw === "1"
      ? { user: { isActive: true } }
      : activeRaw === "0"
      ? { user: { isActive: false } }
      : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const sellers = await prisma.sellerProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      displayName: true,
      slug: true,
      status: true,
      commissionRate: true,
      payoutAccountRef: true,
      rating: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          products: true,
          orders: true,
          services: true,
        },
      },
    },
    take: 200,
  });

  return NextResponse.json(sellers);
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userId = normalizeOptionalString(body?.userId);
  const displayNameInput = normalizeOptionalString(body?.displayName);
  const slugInput = normalizeOptionalString(body?.slug);
  const statusRaw = normalizeOptionalString(body?.status) ?? "PENDING";
  const payoutAccountRef = normalizeOptionalString(body?.payoutAccountRef) ?? null;

  const commissionRate =
    typeof body?.commissionRate === "number"
      ? Math.trunc(body.commissionRate)
      : 10;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!allowedSellerStatuses.has(statusRaw as SellerStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (commissionRate < 0 || commissionRate > 100) {
    return NextResponse.json({ error: "Invalid commission rate" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "Seller profile already exists" }, { status: 409 });
  }

  const displayName =
    displayNameInput ?? user.name ?? user.email.split("@")[0] ?? "New seller";
  const slug = slugify(slugInput ?? displayName);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const seller = await tx.sellerProfile.create({
        data: {
          userId,
          displayName,
          slug,
          status: statusRaw as SellerStatus,
          commissionRate,
          payoutAccountRef,
        },
        select: {
          id: true,
          userId: true,
          displayName: true,
          slug: true,
          status: true,
          commissionRate: true,
          rating: true,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.SELLER },
      });

      return seller;
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