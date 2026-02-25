import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-security";

function serializeSellerDetailPublic(seller: {
  id: string;
  displayName: string;
  slug: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string | null };
  products: Array<{
    id: string;
    title: string;
    slug: string;
    priceCents: number;
    currency: string;
    createdAt: Date;
    images: Array<{ url: string; alt: string | null; position: number }>;
  }>;
  services: Array<{
    id: string;
    title: string;
    description: string | null;
    priceCents: number;
    currency: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: seller.id,
    displayName: seller.displayName,
    slug: seller.slug,
    rating: seller.rating,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
    user: { name: seller.user.name },
    products: seller.products,
    services: seller.services,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const seller = await prisma.sellerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      slug: true,
      rating: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true } },
      products: {
        where: { isActive: true },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          priceCents: true,
          currency: true,
          createdAt: true,
          images: {
            select: { url: true, alt: true, position: true },
            orderBy: { position: "asc" },
            take: 4,
          },
        },
      },
      services: {
        where: { isActive: true },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          priceCents: true,
          currency: true,
          createdAt: true,
        },
      },
    },
  });

  if (!seller) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeSellerDetailPublic(seller));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const seller = await prisma.sellerProfile.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!seller) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = seller.userId === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    data.displayName = String(body.displayName).trim();
  }

  if (body.slug !== undefined) {
    data.slug = String(body.slug).trim();
  }

  if (body.payoutAccountRef !== undefined) {
    data.payoutAccountRef = body.payoutAccountRef
      ? String(body.payoutAccountRef)
      : null;
  }

  if (body.status !== undefined) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admin can update seller status" },
        { status: 403 }
      );
    }
    data.status = body.status;
  }

  if (body.commissionRate !== undefined) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admin can update commission rate" },
        { status: 403 }
      );
    }
    data.commissionRate = Number(body.commissionRate);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.sellerProfile.update({
    where: { id: seller.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.sellerProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

