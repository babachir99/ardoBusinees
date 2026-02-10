import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInquiryReadTrackingUpdate } from "@/lib/inquiryReadTracking";

type OfferAction = "ACCEPT" | "REJECT" | "CANCEL";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const { id, offerId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").toUpperCase() as OfferAction;

  if (!["ACCEPT", "REJECT", "CANCEL"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const offer = await prisma.productOffer.findUnique({
    where: { id: offerId },
    include: {
      inquiry: {
        select: {
          id: true,
          buyerId: true,
          seller: { select: { userId: true } },
          product: { select: { title: true } },
        },
      },
    },
  });

  if (!offer || offer.inquiryId !== id) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isSeller = offer.inquiry.seller?.userId === session.user.id;
  const isBuyer = offer.buyerId === session.user.id;

  if (!isAdmin && !isSeller && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (offer.status !== "PENDING") {
    return NextResponse.json({ error: "Offer already resolved" }, { status: 400 });
  }

  if (action === "ACCEPT" || action === "REJECT") {
    if (!isAdmin && !isSeller) {
      return NextResponse.json({ error: "Only seller can process this offer" }, { status: 403 });
    }
  }

  if (action === "CANCEL") {
    if (!isAdmin && !isBuyer) {
      return NextResponse.json({ error: "Only buyer can cancel this offer" }, { status: 403 });
    }
  }

  const nextStatus =
    action === "ACCEPT" ? "ACCEPTED" : action === "REJECT" ? "REJECTED" : "CANCELED";

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const offerUpdated = await tx.productOffer.update({
      where: { id: offer.id },
      data: {
        status: nextStatus,
        resolvedAt: now,
      },
    });

    if (nextStatus === "ACCEPTED") {
      await tx.productOffer.updateMany({
        where: {
          inquiryId: offer.inquiryId,
          status: "PENDING",
          id: { not: offer.id },
        },
        data: {
          status: "REJECTED",
          resolvedAt: now,
        },
      });
    }

    const actorIsBuyer = offer.inquiry.buyerId === session.user.id;
    await tx.productInquiry.update({
      where: { id: offer.inquiryId },
      data: {
        status: "OPEN",
        lastMessageAt: now,
        ...(actorIsBuyer
          ? getInquiryReadTrackingUpdate("buyer", now)
          : getInquiryReadTrackingUpdate("seller", now)),
      },
    });

    const statusLabel =
      nextStatus === "ACCEPTED"
        ? "accepted"
        : nextStatus === "REJECTED"
        ? "rejected"
        : "canceled";

    await tx.productInquiryMessage.create({
      data: {
        inquiryId: offer.inquiryId,
        senderId: session.user.id,
        body: `Offer ${statusLabel}: ${Math.round(offer.amountCents / 100)} ${offer.currency} x${offer.quantity}`,
      },
    });

    return offerUpdated;
  });

  return NextResponse.json(updated);
}
