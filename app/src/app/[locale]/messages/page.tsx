import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Footer from "@/components/layout/Footer";
import ConversationsList from "@/components/messages/ConversationsList";
import type { Prisma } from "@prisma/client";
import { parseMessageBody } from "@/lib/message-attachments";

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; deliveryId?: string }>;
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

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const where: Prisma.ProductInquiryWhereInput = {
    OR: [{ buyerId: session.user.id }, ...(sellerProfile ? [{ sellerId: sellerProfile.id }] : [])],
    ...(statusFilter === "all"
      ? {}
      : {
          status: statusFilter === "open" ? "OPEN" : "CLOSED",
        }),
  };

  const [inquiries, tiakConversations] = await Promise.all([
    prisma.productInquiry.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 60,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
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
      take: 80,
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

  const filters = [
    { key: "all", label: isFr ? "Toutes" : "All" },
    { key: "open", label: isFr ? "Ouvertes" : "Open" },
    { key: "closed", label: isFr ? "Fermees" : "Closed" },
  ] as const;

  const activeThreadsCount = inquiries.length + tiakConversations.length;

  const activeTiakDeliveryId =
    requestedDeliveryId && tiakConversations.some((item) => item.id === requestedDeliveryId)
      ? requestedDeliveryId
      : (tiakConversations[0]?.id ?? null);

  const buildMessagesHref = (nextStatus: string, deliveryId?: string | null) => {
    const query = new URLSearchParams();
    if (nextStatus !== "all") query.set("status", nextStatus);
    if (deliveryId) query.set("deliveryId", deliveryId);
    const value = query.toString();
    return value ? `/messages?${value}` : "/messages";
  };

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

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const active = statusFilter === filter.key;
            return (
              <Link
                key={filter.key}
                href={buildMessagesHref(filter.key, activeTiakDeliveryId)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-emerald-300/70 bg-emerald-300/15 text-emerald-200"
                    : "border-white/15 bg-zinc-900/70 text-zinc-300 hover:border-white/40"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {tiakConversations.length > 0 ? (
          <ConversationsList
            locale={locale}
            meId={session.user.id}
            conversations={tiakConversations}
            initialSelectedId={activeTiakDeliveryId}
          />
        ) : null}

        {inquiries.length === 0 && tiakConversations.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-center text-zinc-400">
            {isFr ? "Aucune discussion pour le moment." : "No conversation yet."}
          </div>
        ) : inquiries.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {inquiries.map((item) => {
              const iAmBuyer = item.buyerId === session.user.id;
              const counterpart = iAmBuyer
                ? item.seller?.displayName || (isFr ? "Vendeur" : "Seller")
                : item.buyer?.name || item.buyer?.email || (isFr ? "Client" : "Customer");

              const lastMessage = item.messages[0];
              const parsedLastMessage = lastMessage ? parseMessageBody(lastMessage.body) : null;
              const unread = unreadByInquiryId.get(item.id) ?? false;

              return (
                <Link
                  key={item.id}
                  href={`/messages/${item.id}`}
                  className={`rounded-3xl border bg-zinc-900/70 p-4 transition ${
                    unread
                      ? "border-emerald-300/50 shadow-[0_0_24px_rgba(16,185,129,0.08)]"
                      : "border-white/10 hover:border-emerald-300/50"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                      {item.product.images[0]?.url ? (
                        <img
                          src={item.product.images[0].url}
                          alt={item.product.images[0].alt ?? item.product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-zinc-600">
                          {isFr ? "Pas d'image" : "No image"}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{item.product.title}</p>
                        {unread ? (
                          <span className="shrink-0 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
                            {isFr ? "Nouveau" : "New"}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-zinc-400">
                        {isFr ? "Avec" : "With"}: {counterpart}
                      </p>

                      <p className={`mt-2 line-clamp-2 text-xs ${unread ? "text-zinc-200" : "text-zinc-500"}`}>
                        {parsedLastMessage?.body || (parsedLastMessage?.attachmentUrl ? (isFr ? "Piece jointe" : "Attachment") : (isFr ? "Aucun message pour le moment." : "No messages yet."))}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {isFr ? "Messages" : "Messages"}: {item._count.messages}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {isFr ? "Offres" : "Offers"}: {item._count.offers}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {item.status === "OPEN"
                            ? isFr
                              ? "Ouverte"
                              : "Open"
                            : isFr
                              ? "Fermee"
                              : "Closed"}
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] text-zinc-500">
                        {new Date(item.lastMessageAt).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
