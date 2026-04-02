import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Footer from "@/components/layout/Footer";
import ConversationsList from "@/components/messages/ConversationsList";
import type { Prisma } from "@prisma/client";
import { parseMessageBody } from "@/lib/message-attachments";
import { getPresenceForUser, serializePresence } from "@/lib/messages/presence";
import {
  countMessageConversations,
  listMessageConversations,
  parseConversationTake,
} from "@/lib/messages/conversations";

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
    shopCursor?: string;
    tiakCursor?: string;
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
  const shopCursor =
    typeof resolvedSearchParams?.shopCursor === "string" ? resolvedSearchParams.shopCursor : null;
  const tiakCursor =
    typeof resolvedSearchParams?.tiakCursor === "string" ? resolvedSearchParams.tiakCursor : null;

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const [
    {
      inquiryConversations,
      tiakConversations,
      hasMoreShopConversations,
      hasMoreTiakConversations,
      nextShopCursor,
      nextTiakCursor,
    },
    counts,
  ] = await Promise.all([
    listMessageConversations({
      userId: session.user.id,
      sellerProfileId: sellerProfile?.id ?? null,
      locale,
      take: conversationTake,
      shopCursor,
      tiakCursor,
    }),
    countMessageConversations(session.user.id, sellerProfile?.id ?? null),
  ]);

  if (requestedDeliveryId && !tiakConversations.some((item) => item.id === requestedDeliveryId)) {
    const requestedConversation = await prisma.tiakDelivery.findFirst({
      where: {
        id: requestedDeliveryId,
        OR: [{ customerId: session.user.id }, { courierId: session.user.id }],
      },
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
      } satisfies Prisma.TiakDeliverySelect,
    });

    if (requestedConversation) {
      const counterpartUserId =
        requestedConversation.customerId === session.user.id
          ? requestedConversation.courier?.id ?? null
          : requestedConversation.customer?.id ?? null;
      const counterpartPresence = serializePresence(await getPresenceForUser(counterpartUserId));
      tiakConversations.unshift({
        ...requestedConversation,
        counterpartUserId,
        counterpartPresence,
      });
    }
  }

  const requestedShopInquiryId =
    requestedThreadId && requestedThreadId.startsWith("shop:") ? requestedThreadId.slice(5) : null;

  if (requestedShopInquiryId && !inquiryConversations.some((item) => item.id === requestedShopInquiryId)) {
    const requestedInquiry = await prisma.productInquiry.findFirst({
      where: {
        id: requestedShopInquiryId,
        OR: [{ buyerId: session.user.id }, ...(sellerProfile ? [{ sellerId: sellerProfile.id }] : [])],
      },
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
    });

    if (requestedInquiry) {
      const lastMessage = requestedInquiry.messages[0];
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

      const iAmBuyer = requestedInquiry.buyerId === session.user.id;
      const counterpart = iAmBuyer
        ? requestedInquiry.seller?.displayName || (isFr ? "Vendeur" : "Seller")
        : requestedInquiry.buyer?.name ||
          requestedInquiry.buyer?.email ||
          (isFr ? "Client" : "Customer");
      const counterpartUserId = iAmBuyer ? (requestedInquiry.seller?.userId ?? null) : requestedInquiry.buyer?.id ?? null;
      const counterpartPresence = serializePresence(await getPresenceForUser(counterpartUserId));
      const unread =
        Boolean(lastMessage) &&
        lastMessage.senderId !== session.user.id &&
        (!(
          iAmBuyer ? requestedInquiry.buyerLastReadAt : requestedInquiry.seller?.userId === session.user.id ? requestedInquiry.sellerLastReadAt : null
        ) ||
          lastMessage.createdAt.getTime() >
            new Date(
              (iAmBuyer
                ? requestedInquiry.buyerLastReadAt
                : requestedInquiry.seller?.userId === session.user.id
                  ? requestedInquiry.sellerLastReadAt
                  : null) ?? 0
            ).getTime());

      inquiryConversations.unshift({
        id: requestedInquiry.id,
        serviceType: "SHOP",
        title: requestedInquiry.product.title,
        counterpart,
        preview,
        updatedAt: requestedInquiry.lastMessageAt,
        unread,
        status: requestedInquiry.status,
        href: `/messages/${requestedInquiry.id}`,
        isSeller: requestedInquiry.seller?.userId === session.user.id,
        sellerName: requestedInquiry.seller?.displayName ?? undefined,
        product: {
          id: requestedInquiry.product.id,
          slug: requestedInquiry.product.slug,
          title: requestedInquiry.product.title,
          type: requestedInquiry.product.type,
          currency: requestedInquiry.product.currency,
        },
        productImageUrl: requestedInquiry.product.images[0]?.url ?? null,
        productImageAlt: requestedInquiry.product.images[0]?.alt ?? requestedInquiry.product.title,
        messagesCount: requestedInquiry._count.messages,
        offersCount: requestedInquiry._count.offers,
        lastActivityAt: requestedInquiry.lastMessageAt,
        initialOffers: [],
        counterpartUserId,
        counterpartPresence,
      });
    }
  }
  const activeThreadsCount = counts.totalCount;

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
                ? `Discussions actives: ${activeThreadsCount} - Non lus: ${counts.unreadTotal}`
                : `Active threads: ${activeThreadsCount} - Unread: ${counts.unreadTotal}`}
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
            hasMoreShopConversations={hasMoreShopConversations}
            hasMoreTiakConversations={hasMoreTiakConversations}
            nextShopCursor={nextShopCursor}
            nextTiakCursor={nextTiakCursor}
            serverUnreadCount={counts.unreadTotal}
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
