import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { Prisma, SellerStatus, UserRole } from "@prisma/client";

const allowedSellerStatuses = new Set(Object.values(SellerStatus));
const allowedRoles = new Set(Object.values(UserRole));

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const displayName = normalizeOptionalString(body?.displayName);
  const slugInput = normalizeOptionalString(body?.slug);
  const statusRaw = normalizeOptionalString(body?.status);
  const payoutAccountRef =
    typeof body?.payoutAccountRef === "string"
      ? body.payoutAccountRef.trim() || null
      : undefined;
  const userRole = normalizeOptionalString(body?.userRole);
  const userIsActive =
    typeof body?.userIsActive === "boolean" ? body.userIsActive : undefined;

  const commissionRate =
    typeof body?.commissionRate === "number"
      ? Math.trunc(body.commissionRate)
      : undefined;
  const rating = typeof body?.rating === "number" ? body.rating : undefined;

  if (
    displayName === undefined &&
    slugInput === undefined &&
    statusRaw === undefined &&
    payoutAccountRef === undefined &&
    userRole === undefined &&
    userIsActive === undefined &&
    commissionRate === undefined &&
    rating === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (statusRaw && !allowedSellerStatuses.has(statusRaw as SellerStatus)) {
    return NextResponse.json({ error: "Invalid seller status" }, { status: 400 });
  }

  if (userRole && !allowedRoles.has(userRole as UserRole)) {
    return NextResponse.json({ error: "Invalid user role" }, { status: 400 });
  }

  if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 100)) {
    return NextResponse.json({ error: "Invalid commission rate" }, { status: 400 });
  }

  if (rating !== undefined && (rating < 0 || rating > 5)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const slug = slugInput ? slugify(slugInput) : undefined;
  if (slugInput && !slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const seller = await tx.sellerProfile.update({
        where: { id },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(statusRaw !== undefined ? { status: statusRaw as SellerStatus } : {}),
          ...(commissionRate !== undefined ? { commissionRate } : {}),
          ...(payoutAccountRef !== undefined ? { payoutAccountRef } : {}),
          ...(rating !== undefined ? { rating } : {}),
        },
        select: {
          id: true,
          userId: true,
          displayName: true,
          slug: true,
          status: true,
          commissionRate: true,
          payoutAccountRef: true,
          rating: true,
          updatedAt: true,
        },
      });

      if (userRole !== undefined || userIsActive !== undefined) {
        await tx.user.update({
          where: { id: seller.userId },
          data: {
            ...(userRole !== undefined ? { role: userRole as UserRole } : {}),
            ...(userIsActive !== undefined ? { isActive: userIsActive } : {}),
          },
        });
      }

      return seller;
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
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const seller = await prisma.sellerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      _count: {
        select: {
          products: true,
          orders: true,
          payouts: true,
          services: true,
          inquiries: true,
          offers: true,
          reviews: true,
        },
      },
    },
  });

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  const hasDependencies =
    seller._count.products > 0 ||
    seller._count.orders > 0 ||
    seller._count.payouts > 0 ||
    seller._count.services > 0 ||
    seller._count.inquiries > 0 ||
    seller._count.offers > 0 ||
    seller._count.reviews > 0;

  if (hasDependencies) {
    return NextResponse.json(
      {
        error:
          "Cannot delete seller with linked data. Suspend the seller instead.",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.sellerProfile.delete({ where: { id } });
    await tx.user.update({
      where: { id: seller.userId },
      data: { role: UserRole.CUSTOMER },
    });
  });

  return NextResponse.json({ ok: true });
}