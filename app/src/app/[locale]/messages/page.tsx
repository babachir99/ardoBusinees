import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Footer from "@/components/layout/Footer";
import ConversationsList from "@/components/messages/ConversationsList";
import type { Prisma } from "@prisma/client";
import { parseMessageBody } from "@/lib/message-attachments";

const DEFAULT_CONVERSATION_TAKE = 24;
const MAX_CONVERSATION_TAKE = 72;

function parseConversationTake(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CONVERSATION_TAKE;
  return Math.min(MAX_CONVERSATION_TAKE, Math.max(DEFAULT_CONVERSATION_TAKE, Math.trunc(parsed)));
}

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    deliveryId?: string;
    thread?: string;
    take?: string;
    quick?: string;
    service?: string;
    q?: string;
  }>;
}) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const isFr = locale === "fr";
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const statusParam = String(resolvedSearchParams?.status ?? "all").toLowerCase();
  const statusFilter = statusParam === "open" || statusParam === "closed" ? statusParam : "all";
  const requestedDeliveryId =
    typeof resolvedSearchParams?.deliveryId === "string" ? resolvedSearchParams.deliveryId : null;
  const requestedThreadId =
    typeof resolvedSearchParams?.thread === "string"
      ? resolvedSearchParams.thread
      : requestedDeliveryId
        ? `tiak:${requestedDeliveryId}`
        : null;
  const conversationTake = parseConversationTake(resolvedSearchParams?.take);

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const where: Prisma.ProductInquiryWhereInput = {
    OR: [{ buyerId: session.user.id }, ...(sellerProfile ? [{ sellerId: sellerProfile.id }] : [])],
  };

  const tiakConversationSelect = {
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
  } satisfies Prisma.TiakDeliverySelect;

  const [rawInquiries, rawTiakConversations] = await Promise.all([
    prisma.productInquiry.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: conversationTake + 1,
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
        OR: [{ customerId: session.user.id }, { courierId: session.user.id }],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: conversationTake + 1,
      select: tiakConversationSelect,
    }),
  ]);

  const hasMoreInquiries = rawInquiries.length > conversationTake;
  const hasMoreTiak = rawTiakConversations.length > conversationTake;
  const inquiries = rawInquiries.slice(0, conversationTake);
  const tiakConversations = rawTiakConversations.slice(0, conversationTake);

  if (requestedDeliveryId && !tiakConversations.some((item) => item.id === requestedDeliveryId)) {
    const requestedConversation = await prisma.tiakDelivery.findFirst({
      where: {
        id: requestedDeliveryId,
        OR: [{ customerId: session.user.id }, { courierId: session.user.id }],
      },
      select: tiakConversationSelect,
    });

    if (requestedConversation) {
      tiakConversations.unshift(requestedConversation);
    }
  }

  const unreadByInquiryId = new Map<string, boolean>();

  for (const inquiry of inquiries) {
    const lastMessage = inquiry.messages[0];
    if (!lastMessage || lastMessage.senderId === session.user.id) {
      unreadByInquiryId.set(inquiry.id, false);
      continue;
    }

    const isBuyer = inquiry.buyerId === session.user.id;
    const isSeller = inquiry.seller?.userId === session.user.id;
    const lastReadAt = isBuyer
      ? inquiry.buyerLastReadAt
      : isSeller
        ? inquiry.sellerLastReadAt
        : null;

    const unread = !lastReadAt || lastMessage.createdAt.getTime() > new Date(lastReadAt).getTime();
    unreadByInquiryId.set(inquiry.id, unread);
  }

  const inquiryUnreadCount = Array.from(unreadByInquiryId.values()).filter(Boolean).length;
  const tiakUnreadCount = tiakConversations.filter(
    (item) => item.events[0] && item.events[0].actorId !== session.user.id
  ).length;

  const inquiryConversations = inquiries.map((item) => {
    const iAmBuyer = item.buyerId === session.user.id;
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
      serviceType: "SHOP" as const,
      title: item.product.title,
      counterpart,
      preview,
      updatedAt: item.lastMessageAt,
      unread: unreadByInquiryId.get(item.id) ?? false,
      status: item.status,
      href: `/messages/${item.id}`,
      isSeller: item.seller?.userId === session.user.id,
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
    };
  });

  const activeThreadsCount = inquiries.length + tiakConversations.length;

  const activeTiakDeliveryId = requestedDeliveryId ?? tiakConversations[0]?.id ?? null;
  const quickParam = String(resolvedSearchParams?.quick ?? "").toUpperCase();
  const initialQuickFilter =
    quickParam === "UNREAD" || quickParam === "OPEN" || quickParam === "CLOSED" || quickParam === "ALL"
      ? quickParam
      : statusFilter === "open"
        ? "OPEN"
        : statusFilter === "closed"
          ? "CLOSED"
          : "ALL";
  const serviceParam = String(resolvedSearchParams?.service ?? "").toUpperCase();
  const initialServiceFilter =
    serviceParam === "TIAK" ||
    serviceParam === "SHOP" ||
    serviceParam === "PRESTA" ||
    serviceParam === "GP" ||
    serviceParam === "IMMO" ||
    serviceParam === "CARS"
      ? serviceParam
      : "ALL";
  const initialSearchQuery =
    typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q.slice(0, 120) : "";

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {isFr ? "Espace client" : "Customer area"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{isFr ? "Messagerie" : "Messages"}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {isFr
                ? `Discussions actives: ${activeThreadsCount} - Non lus: ${inquiryUnreadCount + tiakUnreadCount}`
                : `Active threads: ${activeThreadsCount} - Unread: ${inquiryUnreadCount + tiakUnreadCount}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/40"
            >
              {isFr ? "Retour accueil" : "Back home"}
            </Link>
          </div>
        </div>

        {tiakConversations.length > 0 || inquiryConversations.length > 0 ? (
          <ConversationsList
            locale={locale}
            meId={session.user.id}
            conversations={tiakConversations}
            inquiryConversations={inquiryConversations}
            initialSelectedConversationId={requestedThreadId ?? (activeTiakDeliveryId ? `tiak:${activeTiakDeliveryId}` : null)}
            initialQuickFilter={initialQuickFilter}
            initialServiceFilter={initialServiceFilter}
            initialQuery={initialSearchQuery}
            serverConversationTake={conversationTake}
            hasMoreShopConversations={hasMoreInquiries}
            hasMoreTiakConversations={hasMoreTiak}
          />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-center text-zinc-400">
            {isFr ? "Aucune discussion pour le moment." : "No conversation yet."}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
