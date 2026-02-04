import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (productId) {
    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: session.user.id, productId } },
    });
    return NextResponse.json({ isFavorite: Boolean(existing) });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: { images: true, seller: { select: { displayName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const productId = String(body?.productId ?? "");
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const favorite = await prisma.favorite.upsert({
    where: { userId_productId: { userId: session.user.id, productId } },
    update: {},
    create: { userId: session.user.id, productId },
  });

  return NextResponse.json(favorite, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") ?? "";
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  await prisma.favorite.delete({
    where: { userId_productId: { userId: session.user.id, productId } },
  });

  return NextResponse.json({ ok: true });
}
