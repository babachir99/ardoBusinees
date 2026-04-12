import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncUserLegacyRoleAssignments } from "@/lib/account-security";
import { slugify } from "@/lib/slug";
import { Prisma, SellerStatus, UserRole } from "@prisma/client";
import { assertSameOrigin } from "@/lib/request-security";

const allowedSellerStatuses = new Set(Object.values(SellerStatus));

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function serializeSellerPublic(seller: {
  id: string;
  displayName: string;
  slug: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string | null };
}) {
  return {
    id: seller.id,
    displayName: seller.displayName,
    slug: seller.slug,
    rating: seller.rating,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
    user: { name: seller.user.name },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;

  const sellers = await prisma.sellerProfile.findMany({
    where: { status: "APPROVED" },
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      slug: true,
      rating: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true } },
    },
  });

  return NextResponse.json(sellers.map(serializeSellerPublic));
}

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestedUserId = normalizeOptionalString(body.userId);
  if (!isAdmin && requestedUserId && requestedUserId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only create a seller profile for yourself" },
      { status: 403 }
    );
  }

  const userId = requestedUserId ?? session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
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
    normalizeOptionalString(body.displayName) ??
    user.name ??
    user.email.split("@")[0] ??
    "New seller";

  const slugInput = normalizeOptionalString(body.slug) ?? displayName;
  const slug = slugify(slugInput);

  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const statusRaw = normalizeOptionalString(body.status);
  if (!isAdmin && statusRaw && statusRaw !== "PENDING") {
    return NextResponse.json(
      { error: "Only admin can set custom seller status" },
      { status: 403 }
    );
  }

  const status = isAdmin ? statusRaw ?? "PENDING" : "PENDING";
  if (!allowedSellerStatuses.has(status as SellerStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (!isAdmin && body.commissionRate !== undefined) {
    return NextResponse.json(
      { error: "Only admin can set commission rate" },
      { status: 403 }
    );
  }

  const commissionRateRaw = body.commissionRate;
  const commissionRate =
    isAdmin && typeof commissionRateRaw === "number"
      ? Math.trunc(commissionRateRaw)
      : 10;

  if (commissionRate < 0 || commissionRate > 100) {
    return NextResponse.json({ error: "Invalid commission rate" }, { status: 400 });
  }

  const payoutAccountRef = normalizeOptionalString(body.payoutAccountRef) ?? null;

  try {
    const seller = await prisma.$transaction(async (tx) => {
      const created = await tx.sellerProfile.create({
        data: {
          userId,
          displayName,
          slug,
          status: status as SellerStatus,
          commissionRate,
          payoutAccountRef,
        },
      });

      if (user.role === UserRole.CUSTOMER) {
        await tx.user.update({
          where: { id: userId },
          data: { role: UserRole.SELLER },
        });
        await syncUserLegacyRoleAssignments(tx, userId, UserRole.SELLER);
      }

      return created;
    });

    return NextResponse.json(seller, { status: 201 });
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

