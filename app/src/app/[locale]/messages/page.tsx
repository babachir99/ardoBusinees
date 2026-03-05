import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Footer from "@/components/layout/Footer";
import TiakConversationThread from "@/components/messages/TiakConversationThread";
import type { Prisma } from "@prisma/client";

function tiakStatusLabel(status: string, isFr: boolean) {
  const fr: Record<string, string> = {
    REQUESTED: "En attente",
    ASSIGNED: "Assignee",
    ACCEPTED: "Acceptee",
    PICKED_UP: "Recuperee",
    DELIVERED: "Livree",
    COMPLETED: "Terminee",
    CANCELED: "Annulee",
    REJECTED: "Rejetee",
  };

  const en: Record<string, string> = {
    REQUESTED: "Requested",
    ASSIGNED: "Assigned",
    ACCEPTED: "Accepted",
    PICKED_UP: "Picked up",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    CANCELED: "Canceled",
    REJECTED: "Rejected",
  };

  return isFr ? (fr[status] ?? status) : (en[status] ?? status);
}

function parseRatingNote(note: string | null) {
  if (!note) return null;
  const match = /^RATING:(\d)(?:\|(.*))?$/i.exec(note.trim());
  if (!match) return null;
  const rating = Number(match[1]);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const comment = typeof match[2] === "string" ? match[2].trim() : "";
  return { rating, comment };
}

const TIAK_SYSTEM_NOTES = new Set([
  "Courier assigned",
  "Courier accepted assignment",
  "Courier declined assignment",
  "Assignment expired",
]);

function isTiakSystemNote(note: string | null) {
  if (!note) return false;
  return TIAK_SYSTEM_NOTES.has(note.trim());
}

function tiakEventPreview(params: {
  isFr: boolean;
  status: string;
  note: string | null;
  actorId: string | null;
  viewerId: string;
  customerName: string;
  courierName: string;
}) {
  const { isFr, status, note, actorId, viewerId, customerName, courierName } = params;
  const ratingInfo = parseRatingNote(note);

  if (ratingInfo) {
    return isFr
      ? `Note ${ratingInfo.rating}/5${ratingInfo.comment ? ` - ${ratingInfo.comment}` : ""}`
      : `Rating ${ratingInfo.rating}/5${ratingInfo.comment ? ` - ${ratingInfo.comment}` : ""}`;
  }

  if (note && note.trim().length > 0 && !isTiakSystemNote(note)) return note;

  if (status === "ASSIGNED") {
    if (viewerId && actorId && viewerId !== actorId && viewerId !== "") {
      return isFr
        ? `${customerName} veut que vous livriez son colis. Acceptez-vous ?`
        : `${customerName} wants you to deliver the parcel. Do you accept?`;
    }
    return isFr
      ? `Votre demande est assignee a ${courierName}.`
      : `Your request has been assigned to ${courierName}.`;
  }

  if (status === "ACCEPTED") {
    return isFr
      ? `${courierName} a accepte la course.`
      : `${courierName} accepted the delivery.`;
  }

  if (status === "PICKED_UP") {
    return isFr
      ? `${courierName} a recupere le colis.`
      : `${courierName} picked up the parcel.`;
  }

  if (status === "DELIVERED") {
    return isFr
      ? `${courierName} a marque la livraison comme terminee.`
      : `${courierName} marked delivery as completed.`;
  }

  if (status === "COMPLETED") {
    return isFr ? "Livraison confirmee." : "Delivery confirmed.";
  }

  if (status === "REJECTED") {
    return isFr ? "Assignation refusee." : "Assignment declined.";
  }

  if (status === "CANCELED") {
    return isFr ? "Course annulee." : "Delivery canceled.";
  }

  return tiakStatusLabel(status, isFr);
}

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
  const requestedDeliveryId = typeof resolvedSearchParams?.deliveryId === "string" ? resolvedSearchParams.deliveryId : null;

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const where: Prisma.ProductInquiryWhereInput = {
    OR: [
      { buyerId: session.user.id },
      ...(sellerProfile ? [{ sellerId: sellerProfile.id }] : []),
    ],
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
      take: 40,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
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
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (deliveryId) params.set("deliveryId", deliveryId);
    const query = params.toString();
    return query ? `/messages?${query}` : "/messages";
  };

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {isFr ? "Espace client" : "Customer area"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {isFr ? "Messagerie" : "Messages"}
            </h1>
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
          <section className="mb-6 rounded-3xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">
                {isFr ? "Conversations TIAK" : "TIAK conversations"}
              </h2>
              <span className="rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5 text-[11px] text-zinc-300">
                {tiakConversations.length}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3">
                {tiakConversations.map((item) => {
                  const iAmCustomer = item.customerId === session.user.id;
                  const counterpart = iAmCustomer
                    ? item.courier?.name || item.courier?.email || (isFr ? "Coursier" : "Courier")
                    : item.customer?.name || item.customer?.email || (isFr ? "Client" : "Customer");
                  const lastEvent = item.events[0];
                  const unread = Boolean(lastEvent && lastEvent.actorId !== session.user.id);
                  const pickupArea = item.pickupAddress.split(",")[0]?.trim() || item.pickupAddress;
                  const dropoffArea = item.dropoffAddress.split(",")[0]?.trim() || item.dropoffAddress;
                  const selected = item.id === activeTiakDeliveryId;

                  return (
                    <Link
                      key={item.id}
                      href={buildMessagesHref(statusFilter, item.id)}
                      className={`block rounded-2xl border bg-zinc-950/70 p-4 transition ${
                        selected
                          ? "border-emerald-300/70 shadow-[0_0_26px_rgba(16,185,129,0.14)]"
                          : unread
                            ? "border-emerald-300/45"
                            : "border-white/10 hover:border-emerald-300/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {pickupArea} -&gt; {dropoffArea}
                        </p>
                        <div className="flex items-center gap-2">
                          {selected ? (
                            <span className="shrink-0 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
                              {isFr ? "Ouvert" : "Open"}
                            </span>
                          ) : null}
                          {unread ? (
                            <span className="shrink-0 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
                              {isFr ? "Nouveau" : "New"}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-zinc-400">
                        {isFr ? "Avec" : "With"}: {counterpart}
                      </p>

                      <p className={`mt-2 line-clamp-2 text-xs ${unread ? "text-zinc-200" : "text-zinc-500"}`}>
                        {lastEvent
                          ? tiakEventPreview({
                              isFr,
                              status: lastEvent.status,
                              note: lastEvent.note,
                              actorId: lastEvent.actorId,
                              viewerId: session.user.id,
                              customerName: item.customer?.name || (isFr ? "Client" : "Customer"),
                              courierName: item.courier?.name || (isFr ? "Coursier" : "Courier"),
                            })
                          : isFr
                            ? "Aucun message pour le moment."
                            : "No messages yet."}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {tiakStatusLabel(item.status, isFr)}
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] text-zinc-500">
                        {new Date(item.updatedAt).toLocaleString(locale)}
                      </p>
                    </Link>
                  );
                })}
              </div>

              {activeTiakDeliveryId ? (
                <TiakConversationThread
                  locale={locale}
                  meId={session.user.id}
                  deliveryId={activeTiakDeliveryId}
                />
              ) : null}
            </div>
          </section>
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
                        {unread && (
                          <span className="shrink-0 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
                            {isFr ? "Nouveau" : "New"}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-zinc-400">
                        {isFr ? "Avec" : "With"}: {counterpart}
                      </p>

                      <p className={`mt-2 line-clamp-2 text-xs ${unread ? "text-zinc-200" : "text-zinc-500"}`}>
                        {lastMessage?.body || (isFr ? "Aucun message pour le moment." : "No messages yet.")}
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
