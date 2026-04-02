import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInquiryReadTrackingUpdate } from "@/lib/inquiryReadTracking";
import type { Prisma } from "@prisma/client";
import { decodeHistoryCursor, encodeHistoryCursor, parseThreadTake } from "@/lib/messages/history";
import { getPresenceForUser, serializePresence } from "@/lib/messages/presence";
import {
  getMessagePolicyErrorMessage,
  getMessagePolicyViolation,
} from "@/lib/messagePolicy";
import {
  normalizeMessageAttachmentUrl,
  parseMessageBody,
  serializeMessageBody,
} from "@/lib/message-attachments";

function getAccessWhere(
  userId: string,
  isAdmin: boolean,
  id: string
): Prisma.ProductInquiryWhereInput {
  if (isAdmin) {
    return { id };
  }

  return {
    id,
    OR: [{ buyerId: userId }, { seller: { userId } }],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const beforeCursor = decodeHistoryCursor(request.nextUrl.searchParams.get("before"));
  const paginated =
    request.nextUrl.searchParams.has("take") || request.nextUrl.searchParams.has("before");
  const take = parseThreadTake(request.nextUrl.searchParams.get("take"));

  const inquiry = await prisma.productInquiry.findFirst({
    where: getAccessWhere(session.user.id, session.user.role === "ADMIN", id),
    include: {
      seller: {
        select: {
          userId: true,
          displayName: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      product: { select: { type: true } },
    },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const readUpdate: Prisma.ProductInquiryUpdateInput =
      inquiry.buyerId === session.user.id
        ? getInquiryReadTrackingUpdate("buyer", new Date())
        : inquiry.seller?.userId === session.user.id
        ? getInquiryReadTrackingUpdate("seller", new Date())
        : {};

    if (Object.keys(readUpdate).length > 0) {
      await prisma.productInquiry.update({
        where: { id: inquiry.id },
        data: readUpdate,
      });
    }
  }

  const counterpartId =
    inquiry.buyerId === session.user.id ? (inquiry.seller?.userId ?? null) : inquiry.buyer?.id ?? null;
  const counterpartPresence = serializePresence(await getPresenceForUser(counterpartId));

  let messages: Array<{
    id: string;
    body: string;
    attachmentUrl: string | null;
    createdAt: Date;
    senderId: string;
    sender: {
      id: string;
      name: string | null;
      email: string | null;
      role: string;
      image: string | null;
    };
  }> = [];
  let hasMore = false;
  let nextCursor: string | null = null;

  if (paginated) {
    const rawMessages = await prisma.productInquiryMessage.findMany({
      where: {
        inquiryId: inquiry.id,
        ...(beforeCursor
          ? {
              OR: [
                { createdAt: { lt: beforeCursor.createdAt } },
                {
                  AND: [{ createdAt: beforeCursor.createdAt }, { id: { lt: beforeCursor.id } }],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, image: true },
        },
      },
    });

    hasMore = rawMessages.length > take;
    const slice = rawMessages.slice(0, take);
    const oldestLoaded = slice[slice.length - 1] ?? null;
    nextCursor = hasMore && oldestLoaded
      ? encodeHistoryCursor({ id: oldestLoaded.id, createdAt: oldestLoaded.createdAt })
      : null;
    messages = slice
      .reverse()
      .map((message) => {
        const parsed = parseMessageBody(message.body);
        return {
          id: message.id,
          body: parsed.body,
          attachmentUrl: parsed.attachmentUrl,
          createdAt: message.createdAt,
          senderId: message.senderId,
          sender: message.sender,
        };
      });
  } else {
    const allMessages = await prisma.productInquiryMessage.findMany({
      where: { inquiryId: inquiry.id },
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, image: true },
        },
      },
    });

    messages = allMessages.map((message) => {
      const parsed = parseMessageBody(message.body);
      return {
        id: message.id,
        body: parsed.body,
        attachmentUrl: parsed.attachmentUrl,
        createdAt: message.createdAt,
        senderId: message.senderId,
        sender: message.sender,
      };
    });
  }

  return NextResponse.json({
    id: inquiry.id,
    status: inquiry.status,
    lastMessageAt: inquiry.lastMessageAt,
    counterpart: counterpartId
      ? {
          id: counterpartId,
          name:
            inquiry.buyerId === session.user.id
              ? inquiry.seller?.displayName || inquiry.seller?.user?.name || inquiry.seller?.user?.email || null
              : inquiry.buyer?.name || inquiry.buyer?.email || null,
          email:
            inquiry.buyerId === session.user.id
              ? inquiry.seller?.user?.email ?? null
              : inquiry.buyer?.email ?? null,
          image:
            inquiry.buyerId === session.user.id
              ? inquiry.seller?.user?.image ?? null
              : inquiry.buyer?.image ?? null,
        }
      : null,
    presence: counterpartPresence,
    pagination: {
      hasMore,
      nextCursor,
      take: paginated ? take : messages.length,
    },
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt,
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

  const inquiry = await prisma.productInquiry.findFirst({
    where: getAccessWhere(session.user.id, session.user.role === "ADMIN", id),
    select: {
      id: true,
      buyerId: true,
      seller: { select: { userId: true } },
      product: { select: { type: true } },
    },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  if (inquiry.product.type !== "LOCAL") {
    return NextResponse.json(
      { error: "Messaging is available only for local products." },
      { status: 403 }
    );
  }

  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const updateData: Prisma.ProductInquiryUpdateInput = {
      status: "OPEN",
      lastMessageAt: now,
    };

    if (inquiry.buyerId === session.user.id) {
      Object.assign(updateData, getInquiryReadTrackingUpdate("buyer", now));
    } else if (inquiry.seller?.userId === session.user.id) {
      Object.assign(updateData, getInquiryReadTrackingUpdate("seller", now));
    }

    await tx.productInquiry.update({
      where: { id: inquiry.id },
      data: updateData,
    });

    return tx.productInquiryMessage.create({
      data: {
        inquiryId: inquiry.id,
        senderId: session.user.id,
        body: serializeMessageBody(message, attachmentUrl),
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, image: true },
        },
      },
    });
  });

  const parsed = parseMessageBody(created.body);

  return NextResponse.json(
    {
      id: created.id,
      body: parsed.body,
      attachmentUrl: parsed.attachmentUrl,
      createdAt: created.createdAt,
      senderId: created.senderId,
      sender: created.sender,
    },
    { status: 201 }
  );
}
