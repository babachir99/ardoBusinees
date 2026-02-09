import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TITLE = 80;
const MAX_COMMENT = 1200;

function normalizeText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

function normalizeRating(value: unknown) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  if (numeric < 1 || numeric > 5) return null;
  return numeric;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const runtimePrisma = prisma as unknown as { productReview?: unknown };
  if (!runtimePrisma.productReview) {
    return NextResponse.json(
      {
        error:
          "Reviews temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, seller: { select: { userId: true } } },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const [reviews, stats, myReview, paidOrderItem] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        buyer: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.productReview.aggregate({
      where: { productId: id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    session?.user?.id
      ? prisma.productReview.findUnique({
          where: {
            productId_buyerId: {
              productId: id,
              buyerId: session.user.id,
            },
          },
        })
      : Promise.resolve(null),
    session?.user?.id
      ? prisma.orderItem.findFirst({
          where: {
            productId: id,
            order: {
              userId: session.user.id,
              paymentStatus: "PAID",
            },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const isSellerOwner = Boolean(session?.user?.id && session.user.id === product.seller?.userId);

  return NextResponse.json({
    stats: {
      average: stats._avg.rating ?? 0,
      count: stats._count._all,
    },
    canReview: Boolean(session?.user?.id && paidOrderItem && !isSellerOwner),
    isSellerOwner,
    myReview,
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      sellerRating: review.sellerRating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      buyer: {
        id: review.buyer.id,
        name: review.buyer.name,
        image: review.buyer.image,
      },
      mine: review.buyerId === session?.user?.id,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runtimePrisma = prisma as unknown as { productReview?: unknown };
  if (!runtimePrisma.productReview) {
    return NextResponse.json(
      {
        error:
          "Reviews temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const rating = normalizeRating(body?.rating);
  const sellerRating = body?.sellerRating === undefined ? null : normalizeRating(body?.sellerRating);
  const title = normalizeText(body?.title, MAX_TITLE);
  const comment = normalizeText(body?.comment, MAX_COMMENT);

  if (rating === null) {
    return NextResponse.json({ error: "invalid rating" }, { status: 400 });
  }

  if (body?.sellerRating !== undefined && sellerRating === null) {
    return NextResponse.json({ error: "invalid seller rating" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sellerId: true,
      seller: { select: { userId: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.seller?.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot review your own product" }, { status: 403 });
  }

  const paidOrderItem = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: {
        userId: session.user.id,
        paymentStatus: "PAID",
      },
    },
    select: { id: true },
  });

  if (!paidOrderItem) {
    return NextResponse.json({ error: "Verified purchase required" }, { status: 403 });
  }

  const saved = await prisma.productReview.upsert({
    where: {
      productId_buyerId: {
        productId: product.id,
        buyerId: session.user.id,
      },
    },
    create: {
      productId: product.id,
      sellerId: product.sellerId,
      buyerId: session.user.id,
      rating,
      sellerRating,
      title,
      comment,
    },
    update: {
      rating,
      sellerRating,
      title,
      comment,
    },
    include: {
      buyer: { select: { id: true, name: true, image: true } },
    },
  });

  const sellerStats = await prisma.productReview.aggregate({
    where: {
      sellerId: product.sellerId,
      sellerRating: { not: null },
    },
    _avg: { sellerRating: true },
    _count: { _all: true },
  });

  if (sellerStats._count._all > 0 && sellerStats._avg.sellerRating !== null) {
    await prisma.sellerProfile.update({
      where: { id: product.sellerId },
      data: { rating: sellerStats._avg.sellerRating },
    });
  }

  return NextResponse.json(
    {
      id: saved.id,
      rating: saved.rating,
      sellerRating: saved.sellerRating,
      title: saved.title,
      comment: saved.comment,
      createdAt: saved.createdAt,
      buyer: saved.buyer,
      mine: true,
    },
    { status: 201 }
  );
}
