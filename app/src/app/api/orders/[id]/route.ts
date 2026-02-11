import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Order id is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              images: { select: { url: true }, take: 1 },
            },
          },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          senderRole: true,
          sender: { select: { name: true, email: true } },
          createdAt: true,
        },
      },
      user: { select: { id: true, email: true, name: true } },
      seller: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          rating: true,
          user: { select: { image: true, name: true } },
        },
      },
      payment: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    if (session.user.role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!seller || seller.id !== order.sellerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.user.id !== order.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const sellerStatsPromise = order.sellerId
    ? Promise.all([
        prisma.product.count({
          where: { sellerId: order.sellerId, isActive: true },
        }),
        prisma.order.count({
          where: { sellerId: order.sellerId, paymentStatus: "PAID" },
        }),
        prisma.productReview.aggregate({
          where: { sellerId: order.sellerId, sellerRating: { not: null } },
          _avg: { sellerRating: true },
          _count: { _all: true },
        }),
      ]).then(([activeProducts, paidOrders, ratingStats]) => ({
        activeProducts,
        paidOrders,
        ratingAverage: ratingStats._avg.sellerRating ?? order.seller?.rating ?? 0,
        ratingCount: ratingStats._count._all,
      }))
    : Promise.resolve(null);
  const [sellerStats] = await Promise.all([sellerStatsPromise]);

  return NextResponse.json({
    ...order,
    sellerStats,
  });
}


