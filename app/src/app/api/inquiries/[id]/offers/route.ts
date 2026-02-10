import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInquiryReadTrackingUpdate } from "@/lib/inquiryReadTracking";

function canAccessInquiry(
  inquiry: {
    buyerId: string;
    seller?: { userId?: string | null } | null;
  },
  userId: string,
  isAdmin: boolean
) {
  if (isAdmin) return true;
  return inquiry.buyerId === userId || inquiry.seller?.userId === userId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inquiry = await prisma.productInquiry.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      seller: { select: { userId: true } },
    },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  if (!canAccessInquiry(inquiry, session.user.id, session.user.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const offers = await prisma.productOffer.findMany({
    where: { inquiryId: id },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { id: true, name: true, email: true } },
    },
    take: 50,
  });

  return NextResponse.json(
    offers.map((offer) => ({
      id: offer.id,
      amountCents: offer.amountCents,
      currency: offer.currency,
      quantity: offer.quantity,
      note: offer.note,
      status: offer.status,
      createdAt: offer.createdAt,
      resolvedAt: offer.resolvedAt,
      buyerId: offer.buyerId,
      buyer: offer.buyer,
    }))
  );
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

  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity ?? 1);
  const amountCents = Number(body?.amountCents ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return NextResponse.json({ error: "invalid quantity" }, { status: 400 });
  }

  if (!Number.isInteger(amountCents) || amountCents < 50) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  if (note.length > 500) {
    return NextResponse.json({ error: "note too long" }, { status: 400 });
  }

  const inquiry = await prisma.productInquiry.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
      seller: { select: { userId: true } },
      product: { select: { title: true, currency: true } },
    },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!canAccessInquiry(inquiry, session.user.id, isAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const actorIsBuyer = inquiry.buyerId === session.user.id;

  if (!isAdmin && !actorIsBuyer) {
    return NextResponse.json(
      { error: "Only buyer can create an offer for now." },
      { status: 403 }
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.productInquiry.update({
      where: { id: inquiry.id },
      data: {
        status: "OPEN",
        lastMessageAt: now,
        ...(actorIsBuyer
          ? getInquiryReadTrackingUpdate("buyer", now)
          : getInquiryReadTrackingUpdate("seller", now)),
      },
    });

    const offer = await tx.productOffer.create({
      data: {
        inquiryId: inquiry.id,
        productId: inquiry.productId,
        buyerId: inquiry.buyerId,
        sellerId: inquiry.sellerId,
        quantity,
        amountCents,
        currency: inquiry.product.currency,
        note: note || undefined,
        status: "PENDING",
      },
    });

    await tx.productInquiryMessage.create({
      data: {
        inquiryId: inquiry.id,
        senderId: session.user.id,
        body: `Offer: ${Math.round(amountCents / 100)} ${inquiry.product.currency} x${quantity}${
          note ? ` - ${note}` : ""
        }`,
      },
    });

    return offer;
  });

  return NextResponse.json(created, { status: 201 });
}



