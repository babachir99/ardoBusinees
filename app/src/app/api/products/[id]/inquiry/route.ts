import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInquiryReadTrackingUpdate } from "@/lib/inquiryReadTracking";
import { isEitherBlocked } from "@/lib/trust-blocks";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runtimePrisma = prisma as unknown as { productInquiry?: unknown };
  if (!runtimePrisma.productInquiry) {
    return NextResponse.json(
      {
        error:
          "Messaging temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      sellerId: true,
      seller: { select: { userId: true, displayName: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const isSellerOwner = product.seller?.userId === session.user.id;

  if (!isSellerOwner && product.type !== "LOCAL") {
    return NextResponse.json({
      blocked: false,
      isSellerOwner: false,
      canNegotiate: false,
      productId: product.id,
      productTitle: product.title,
      meId: session.user.id,
      inquiry: null,
      messages: [],
      offers: [],
    });
  }

  const blocked = product.seller?.userId
    ? await isEitherBlocked(session.user.id, product.seller.userId)
    : false;

  if (blocked) {
    return NextResponse.json({
      blocked: true,
      blockedMessage: "Messaging disabled because one account blocked the other.",
      isSellerOwner: false,
      canNegotiate: false,
      productId: product.id,
      productTitle: product.title,
      meId: session.user.id,
      inquiry: null,
      messages: [],
      offers: [],
    });
  }

  if (isSellerOwner) {
    return NextResponse.json({
      blocked: false,
      isSellerOwner: true,
      productId: product.id,
      productTitle: product.title,
      meId: session.user.id,
      inquiry: null,
      messages: [],
      offers: [],
    });
  }

  const inquiry = await prisma.productInquiry.findUnique({
    where: {
      productId_buyerId: {
        productId: product.id,
        buyerId: session.user.id,
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 80,
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      offers: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (inquiry) {
    const readUpdate = getInquiryReadTrackingUpdate("buyer", new Date());
    if (Object.keys(readUpdate).length > 0) {
      await prisma.productInquiry.update({
        where: { id: inquiry.id },
        data: readUpdate,
      });
    }
  }

  return NextResponse.json({
    blocked: false,
    isSellerOwner: false,
    productId: product.id,
    productTitle: product.title,
    sellerDisplayName: product.seller?.displayName,
    meId: session.user.id,
    inquiry: inquiry
      ? {
          id: inquiry.id,
          status: inquiry.status,
          lastMessageAt: inquiry.lastMessageAt,
        }
      : null,
    messages:
      inquiry?.messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        senderId: message.senderId,
        sender: message.sender,
      })) ?? [],
    offers:
      inquiry?.offers.map((offer) => ({
        id: offer.id,
        amountCents: offer.amountCents,
        currency: offer.currency,
        quantity: offer.quantity,
        status: offer.status,
        note: offer.note,
        createdAt: offer.createdAt,
      })) ?? [],
  });
}




