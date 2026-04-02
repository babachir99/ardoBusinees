import { Prisma } from "@prisma/client";
import { parseMessageBody } from "@/lib/message-attachments";
import { getPresenceMap, serializePresence, type MessagePresenceSummary } from "@/lib/messages/presence";
import { prisma } from "@/lib/prisma";

export const DEFAULT_CONVERSATION_TAKE = 24;
export const MAX_CONVERSATION_TAKE = 72;

type CursorPayload = {
  updatedAt: string;
  id: string;
};

export type TiakConversationSummary = {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  updatedAt: string | Date;
  customerId: string;
  courierId: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  courier: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  events: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: string | Date;
    actorId: string;
  }>;
  counterpartUserId: string | null;
  counterpartPresence: MessagePresenceSummary | null;
};

export type InquiryOfferItem = {
  id: string;
  amountCents: number;
  currency: string;
  quantity: number;
  note?: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED" | "EXPIRED";
  createdAt: string;
  resolvedAt?: string | null;
  buyerId: string;
  buyer?: { id: string; name?: string | null; email?: string | null } | null;
};

export type InquiryConversationSummary = {
  id: string;
  serviceType: "SHOP";
  title: string;
  counterpart: string;
  preview: string;
  updatedAt: string | Date;
  unread: boolean;
  status: "OPEN" | "CLOSED";
  href: string;
  isSeller: boolean;
  sellerName?: string;
  product: {
    id: string;
    slug: string;
    title: string;
    type: "PREORDER" | "DROPSHIP" | "LOCAL";
    currency: string;
  };
  productImageUrl: string | null;
  productImageAlt: string;
  messagesCount: number;
  offersCount: number;
  lastActivityAt: string | Date;
  initialOffers: InquiryOfferItem[];
  counterpartUserId: string | null;
  counterpartPresence: MessagePresenceSummary | null;
};

type ConversationFeedOptions = {
  userId: string;
  sellerProfileId: string | null;
  locale: string;
  take: number;
  shopCursor?: string | null;
  tiakCursor?: string | null;
};

type ConversationFeedResult = {
  inquiryConversations: InquiryConversationSummary[];
  tiakConversations: TiakConversationSummary[];
  hasMoreShopConversations: boolean;
  hasMoreTiakConversations: boolean;
  nextShopCursor: string | null;
  nextTiakCursor: string | null;
};

function decodeCursor(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CursorPayload;
    const updatedAt = new Date(parsed.updatedAt);
    if (!parsed.id || Number.isNaN(updatedAt.getTime())) return null;
    return {
      updatedAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function encodeCursor(value: { updatedAt: Date; id: string } | null) {
  if (!value) return null;
  return Buffer.from(
    JSON.stringify({
      updatedAt: value.updatedAt.toISOString(),
      id: value.id,
    }),
    "utf8"
  ).toString("base64url");
}

export function parseConversationTake(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CONVERSATION_TAKE;
  return Math.min(MAX_CONVERSATION_TAKE, Math.max(DEFAULT_CONVERSATION_TAKE, Math.trunc(parsed)));
}

function buildInquiryWhere(userId: string, sellerProfileId: string | null) {
  return {
    OR: [{ buyerId: userId }, ...(sellerProfileId ? [{ sellerId: sellerProfileId }] : [])],
  } satisfies Prisma.ProductInquiryWhereInput;
}

function buildShopCursorWhere(cursor: ReturnType<typeof decodeCursor>) {
  if (!cursor) return {};

  return {
    OR: [
      { lastMessageAt: { lt: cursor.updatedAt } },
      {
        AND: [{ lastMessageAt: cursor.updatedAt }, { id: { lt: cursor.id } }],
      },
    ],
  } satisfies Prisma.ProductInquiryWhereInput;
}

function buildTiakCursorWhere(cursor: ReturnType<typeof decodeCursor>) {
  if (!cursor) return {};

  return {
    OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      {
        AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.id } }],
      },
    ],
  } satisfies Prisma.TiakDeliveryWhereInput;
}

export async function listMessageConversations({
  userId,
  sellerProfileId,
  locale,
  take,
  shopCursor,
  tiakCursor,
}: ConversationFeedOptions): Promise<ConversationFeedResult> {
  const isFr = locale === "fr";
  const shopDecodedCursor = decodeCursor(shopCursor);
  const tiakDecodedCursor = decodeCursor(tiakCursor);
  const inquiryWhere = buildInquiryWhere(userId, sellerProfileId);

  const [rawInquiries, rawTiakConversations] = await Promise.all([
    prisma.productInquiry.findMany({
      where: {
        AND: [inquiryWhere, buildShopCursorWhere(shopDecodedCursor)],
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            currency: true,
            images: {
              orderBy: { position: "asc" },
              take: 1,
              select: { url: true, alt: true },
            },
          },
        },
        buyer: {
          select: { id: true, name: true, email: true },
        },
        seller: {
          select: { id: true, displayName: true, userId: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
            offers: true,
          },
        },
      },
    }),
    prisma.tiakDelivery.findMany({
      where: {
        OR: [{ customerId: userId }, { courierId: userId }],
        AND: [buildTiakCursorWhere(tiakDecodedCursor)],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        updatedAt: true,
        customerId: true,
        courierId: true,
        customer: {
          select: { id: true, name: true, email: true },
        },
        courier: {
          select: { id: true, name: true, email: true },
        },
        events: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            note: true,
            createdAt: true,
            actorId: true,
          },
        },
      },
    }),
  ]);

  const hasMoreShopConversations = rawInquiries.length > take;
  const hasMoreTiakConversations = rawTiakConversations.length > take;
  const inquiries = rawInquiries.slice(0, take);
  const tiakConversations = rawTiakConversations.slice(0, take);
  const counterpartIds = [
    ...inquiries.map((inquiry) =>
      inquiry.buyerId === userId ? (inquiry.seller?.userId ?? null) : inquiry.buyer?.id
    ),
    ...tiakConversations.map((conversation) =>
      conversation.customerId === userId ? conversation.courier?.id ?? null : conversation.customer?.id
    ),
  ];
  const presenceMap = await getPresenceMap(counterpartIds);

  const unreadByInquiryId = new Map<string, boolean>();

  for (const inquiry of inquiries) {
    const lastMessage = inquiry.messages[0];
    if (!lastMessage || lastMessage.senderId === userId) {
      unreadByInquiryId.set(inquiry.id, false);
      continue;
    }

    const isBuyer = inquiry.buyerId === userId;
    const isSeller = inquiry.seller?.userId === userId;
    const lastReadAt = isBuyer ? inquiry.buyerLastReadAt : isSeller ? inquiry.sellerLastReadAt : null;
    const unread = !lastReadAt || lastMessage.createdAt.getTime() > new Date(lastReadAt).getTime();
    unreadByInquiryId.set(inquiry.id, unread);
  }

  const inquiryConversations: InquiryConversationSummary[] = inquiries.map((item) => {
    const iAmBuyer = item.buyerId === userId;
    const counterpartUserId = iAmBuyer ? (item.seller?.userId ?? null) : item.buyer?.id ?? null;
    const counterpart = iAmBuyer
      ? item.seller?.displayName || (isFr ? "Vendeur" : "Seller")
      : item.buyer?.name || item.buyer?.email || (isFr ? "Client" : "Customer");

    const lastMessage = item.messages[0];
    const parsedLastMessage = lastMessage ? parseMessageBody(lastMessage.body) : null;
    const preview =
      parsedLastMessage?.body ||
      (parsedLastMessage?.attachmentUrl
        ? isFr
          ? "Piece jointe"
          : "Attachment"
        : isFr
          ? "Aucun message pour le moment."
          : "No messages yet.");

    return {
      id: item.id,
      serviceType: "SHOP",
      title: item.product.title,
      counterpart,
      preview,
      updatedAt: item.lastMessageAt,
      unread: unreadByInquiryId.get(item.id) ?? false,
      status: item.status,
      href: `/messages/${item.id}`,
      isSeller: item.seller?.userId === userId,
      sellerName: item.seller?.displayName ?? undefined,
      product: {
        id: item.product.id,
        slug: item.product.slug,
        title: item.product.title,
        type: item.product.type,
        currency: item.product.currency,
      },
      productImageUrl: item.product.images[0]?.url ?? null,
      productImageAlt: item.product.images[0]?.alt ?? item.product.title,
      messagesCount: item._count.messages,
      offersCount: item._count.offers,
      lastActivityAt: item.lastMessageAt,
      initialOffers: [],
      counterpartUserId,
      counterpartPresence: serializePresence(
        counterpartUserId ? presenceMap.get(counterpartUserId) ?? null : null
      ),
    };
  });

  return {
    inquiryConversations,
    tiakConversations: tiakConversations.map((item) => {
      const counterpartUserId =
        item.customerId === userId ? item.courier?.id ?? null : item.customer?.id ?? null;
      return {
        ...item,
        counterpartUserId,
        counterpartPresence: serializePresence(
          counterpartUserId ? presenceMap.get(counterpartUserId) ?? null : null
        ),
      };
    }),
    hasMoreShopConversations,
    hasMoreTiakConversations,
    nextShopCursor:
      hasMoreShopConversations && inquiries.length > 0
        ? encodeCursor({
            updatedAt: inquiries[inquiries.length - 1].lastMessageAt,
            id: inquiries[inquiries.length - 1].id,
          })
        : null,
    nextTiakCursor:
      hasMoreTiakConversations && tiakConversations.length > 0
        ? encodeCursor({
            updatedAt: tiakConversations[tiakConversations.length - 1].updatedAt,
            id: tiakConversations[tiakConversations.length - 1].id,
          })
        : null,
  };
}

export async function countMessageConversations(userId: string, sellerProfileId: string | null) {
  const inquiryWhere = buildInquiryWhere(userId, sellerProfileId);

  const [shopCount, tiakCount, inquiries, tiakDeliveries] = await Promise.all([
    prisma.productInquiry.count({ where: inquiryWhere }),
    prisma.tiakDelivery.count({
      where: {
        OR: [{ customerId: userId }, { courierId: userId }],
      },
    }),
    prisma.productInquiry.findMany({
      where: inquiryWhere,
      select: {
        id: true,
        buyerId: true,
        buyerLastReadAt: true,
        sellerLastReadAt: true,
        seller: {
          select: { userId: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            senderId: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.tiakDelivery.findMany({
      where: {
        OR: [{ customerId: userId }, { courierId: userId }],
      },
      select: {
        id: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            actorId: true,
          },
        },
      },
    }),
  ]);

  const shopUnreadCount = inquiries.reduce((count, inquiry) => {
    const lastMessage = inquiry.messages[0];
    if (!lastMessage || lastMessage.senderId === userId) return count;

    const lastReadAt =
      inquiry.buyerId === userId
        ? inquiry.buyerLastReadAt
        : inquiry.seller?.userId === userId
          ? inquiry.sellerLastReadAt
          : null;

    const unread = !lastReadAt || lastMessage.createdAt.getTime() > new Date(lastReadAt).getTime();
    return unread ? count + 1 : count;
  }, 0);

  const tiakUnreadCount = tiakDeliveries.reduce((count, delivery) => {
    const lastEvent = delivery.events[0];
    return lastEvent && lastEvent.actorId !== userId ? count + 1 : count;
  }, 0);

  return {
    shopCount,
    tiakCount,
    shopUnreadCount,
    tiakUnreadCount,
    unreadTotal: shopUnreadCount + tiakUnreadCount,
    totalCount: shopCount + tiakCount,
  };
}
