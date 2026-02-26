import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getMessagePolicyErrorMessage,
  getMessagePolicyViolation,
} from "@/lib/messagePolicy";
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

  const runtimePrisma = prisma as unknown as { productOffer?: unknown };
  if (!runtimePrisma.productOffer) {
    return NextResponse.json(
      {
        error:
          "Offers temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      sellerId: true,
      seller: { select: { userId: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.type !== "LOCAL") {
    return NextResponse.json(
      { error: "Offers are available only for local products." },
      { status: 403 }
    );
  }

  if (product.seller?.userId && (await isEitherBlocked(session.user.id, product.seller.userId))) {
    return NextResponse.json(
      { error: "Offers disabled because one account blocked the other." },
      { status: 403 }
    );
  }

  if (product.seller?.userId === session.user.id) {
    const sellerOffers = await prisma.productOffer.findMany({
      where: { productId: product.id, sellerId: product.sellerId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        buyer: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      sellerOffers.map((offer) => ({
        id: offer.id,
        amountCents: offer.amountCents,
        currency: offer.currency,
        quantity: offer.quantity,
        note: offer.note,
        status: offer.status,
        createdAt: offer.createdAt,
        buyer: offer.buyer,
      }))
    );
  }

  const myOffers = await prisma.productOffer.findMany({
    where: { productId: product.id, buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json(myOffers);
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

  const runtimePrisma = prisma as unknown as {
    productOffer?: unknown;
    productInquiry?: unknown;
    productInquiryMessage?: unknown;
  };

  if (
    !runtimePrisma.productOffer ||
    !runtimePrisma.productInquiry ||
    !runtimePrisma.productInquiryMessage
  ) {
    return NextResponse.json(
      {
        error:
          "Offers temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
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

  if (note) {
    const locale = request.headers
      .get("accept-language")
      ?.toLowerCase()
      .startsWith("fr")
      ? "fr"
      : "en";
    const violation = getMessagePolicyViolation(note);
    if (violation) {
      return NextResponse.json(
        { error: getMessagePolicyErrorMessage(locale) },
        { status: 400 }
      );
    }
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      currency: true,
      sellerId: true,
      seller: { select: { userId: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.type !== "LOCAL") {
    return NextResponse.json(
      { error: "Offers are available only for local products." },
      { status: 403 }
    );
  }

  if (product.seller?.userId && (await isEitherBlocked(session.user.id, product.seller.userId))) {
    return NextResponse.json(
      { error: "Offers disabled because one account blocked the other." },
      { status: 403 }
    );
  }

  if (product.seller?.userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot send an offer on your own product." },
      { status: 403 }
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const inquiry = await tx.productInquiry.upsert({
      where: {
        productId_buyerId: {
          productId: product.id,
          buyerId: session.user.id,
        },
      },
      create: {
        productId: product.id,
        buyerId: session.user.id,
        sellerId: product.sellerId,
        status: "OPEN",
        lastMessageAt: now,
      },
      update: {
        status: "OPEN",
        lastMessageAt: now,
      },
      select: { id: true },
    });

    const offer = await tx.productOffer.create({
      data: {
        inquiryId: inquiry.id,
        productId: product.id,
        buyerId: session.user.id,
        sellerId: product.sellerId,
        quantity,
        amountCents,
        currency: product.currency,
        note: note || undefined,
        status: "PENDING",
      },
    });

    await tx.productInquiryMessage.create({
      data: {
        inquiryId: inquiry.id,
        senderId: session.user.id,
        body: `Offer: ${Math.round(amountCents / 100)} ${product.currency} x${quantity}${
          note ? ` - ${note}` : ""
        }`,
      },
    });

    return offer;
  });

  return NextResponse.json(result, { status: 201 });
}
