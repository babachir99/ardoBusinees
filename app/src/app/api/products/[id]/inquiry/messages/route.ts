import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInquiryReadTrackingUpdate } from "@/lib/inquiryReadTracking";
import {
  getMessagePolicyErrorMessage,
  getMessagePolicyViolation,
} from "@/lib/messagePolicy";
import { isEitherBlocked } from "@/lib/trust-blocks";
import { NotificationService } from "@/lib/notifications/NotificationService";
import {
  normalizeMessageAttachmentUrl,
  parseMessageBody,
  serializeMessageBody,
} from "@/lib/message-attachments";

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
    productInquiry?: unknown;
    productInquiryMessage?: unknown;
  };

  if (!runtimePrisma.productInquiry || !runtimePrisma.productInquiryMessage) {
    return NextResponse.json(
      {
        error:
          "Messaging temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const message = String(body?.message ?? "").trim();
  const attachmentUrl = normalizeMessageAttachmentUrl((body as { attachmentUrl?: unknown } | null)?.attachmentUrl);

  if (!message && !attachmentUrl) {
    return NextResponse.json({ error: "message or attachment is required" }, { status: 400 });
  }

  if (message.length > 1200) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const locale = request.headers.get("accept-language")?.toLowerCase().startsWith("fr")
    ? "fr"
    : "en";
  const violation = message ? getMessagePolicyViolation(message) : null;
  if (violation) {
    return NextResponse.json(
      { error: getMessagePolicyErrorMessage(locale) },
      { status: 400 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
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
      { error: "Messaging is available only for local products." },
      { status: 403 }
    );
  }

  if (product.seller?.userId && (await isEitherBlocked(session.user.id, product.seller.userId))) {
    return NextResponse.json(
      { error: "Messaging disabled because one account blocked the other." },
      { status: 403 }
    );
  }

  if (product.seller?.userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot start a buyer conversation on your own product." },
      { status: 403 }
    );
  }

  const now = new Date();
  const buyerReadUpdate = getInquiryReadTrackingUpdate("buyer", now);

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
        ...buyerReadUpdate,
      },
      update: {
        status: "OPEN",
        lastMessageAt: now,
        ...buyerReadUpdate,
      },
      select: { id: true },
    });

    const created = await tx.productInquiryMessage.create({
      data: {
        inquiryId: inquiry.id,
        senderId: session.user.id,
        body: serializeMessageBody(message, attachmentUrl),
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return {
      inquiryId: inquiry.id,
      message: created,
    };
  });

  await NotificationService.queueContactAckEmail({
    userId: session.user.id,
    contextLabel: product.title || product.id,
    dedupeKey: `contact_ack:inquiry:${result.inquiryId}:user:${session.user.id}`,
  }).catch(() => null);

  const parsed = parseMessageBody(result.message.body);

  return NextResponse.json(
    {
      id: result.message.id,
      body: parsed.body,
      attachmentUrl: parsed.attachmentUrl,
      createdAt: result.message.createdAt,
      senderId: result.message.senderId,
      sender: result.message.sender,
    },
    { status: 201 }
  );
}
