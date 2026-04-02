"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { TiakDelivery, TiakDeliveryEvent } from "@/components/tiak/types";
import ChatPanel from "@/components/messages/ChatPanel";
import OpsDetailsPanel from "@/components/messages/OpsDetailsPanel";
import InquiryChatThread from "@/components/messages/InquiryChatThread";
import InquiryOffersPanel from "@/components/messages/InquiryOffersPanel";

type TiakConversationSummary = {
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
};

type InquiryOfferItem = {
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

type InquiryConversationSummary = {
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
};

type Props = {
  locale: string;
  meId: string;
  conversations: TiakConversationSummary[];
  inquiryConversations: InquiryConversationSummary[];
  initialSelectedId: string | null;
  initialQuickFilter?: QuickFilter;
};

type QuickFilter = "ALL" | "UNREAD" | "OPEN" | "CLOSED";
type ServiceType = "ALL" | "TIAK" | "SHOP" | "PRESTA" | "GP" | "IMMO" | "CARS";

type UnifiedConversation = {
  id: string;
  sourceId: string;
  kind: "TIAK" | "SHOP";
  serviceType: Exclude<ServiceType, "ALL">;
  title: string;
  counterpart: string;
  preview: string;
  updatedAt: string | Date;
  unreadCount: number;
  statusRaw: string;
  statusLabel: string;
  isClosed: boolean;
  href?: string;
};

const CLOSED_TIAK_STATUSES = new Set(["COMPLETED", "CANCELED", "REJECTED"]);
const SYSTEM_NOTES = new Set([
  "Courier assigned",
  "Courier accepted assignment",
  "Courier declined assignment",
  "Assignment expired",
]);

const SERVICE_TABS: ServiceType[] = ["ALL", "TIAK", "SHOP", "PRESTA", "GP", "IMMO", "CARS"];

function toArea(value: string) {
  return value.split(",")[0]?.trim() || value;
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

function formatTiakStatus(status: string, locale: string) {
  const isFr = locale === "fr";
  const fr: Record<string, string> = {
    REQUESTED: "Ouverte",
    ASSIGNED: "Assignee",
    ACCEPTED: "Acceptee",
    PICKED_UP: "En cours",
    DELIVERED: "Livree",
    COMPLETED: "Terminee",
    CANCELED: "Annulee",
    REJECTED: "Rejetee",
  };

  const en: Record<string, string> = {
    REQUESTED: "Open",
    ASSIGNED: "Assigned",
    ACCEPTED: "Accepted",
    PICKED_UP: "In progress",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    CANCELED: "Canceled",
    REJECTED: "Rejected",
  };

  return isFr ? (fr[status] ?? status) : (en[status] ?? status);
}

function formatInquiryStatus(status: "OPEN" | "CLOSED", locale: string) {
  const isFr = locale === "fr";
  if (status === "OPEN") return isFr ? "Ouverte" : "Open";
  return isFr ? "Fermee" : "Closed";
}

function previewText(params: {
  locale: string;
  meId: string;
  status: string;
  note: string | null;
  actorId: string | null;
  customerName: string;
  courierName: string;
}) {
  const { locale, meId, status, note, actorId, customerName, courierName } = params;
  const isFr = locale === "fr";
  const rating = parseRatingNote(note);

  if (rating) {
    return isFr
      ? `Note ${rating.rating}/5${rating.comment ? ` - ${rating.comment}` : ""}`
      : `Rating ${rating.rating}/5${rating.comment ? ` - ${rating.comment}` : ""}`;
  }

  if (note && note.trim().length > 0 && !SYSTEM_NOTES.has(note.trim())) {
    return note;
  }

  if (status === "ASSIGNED") {
    return meId === actorId
      ? isFr
        ? `Votre demande est assignee a ${courierName}.`
        : `Your request has been assigned to ${courierName}.`
      : isFr
        ? `${customerName} veut que vous livriez son colis.`
        : `${customerName} wants you to deliver the parcel.`;
  }

  if (status === "ACCEPTED") return isFr ? "Course acceptee." : "Delivery accepted.";
  if (status === "PICKED_UP") return isFr ? "Colis recupere." : "Parcel picked up.";
  if (status === "DELIVERED") return isFr ? "Livraison marquee terminee." : "Delivery marked completed.";
  if (status === "COMPLETED") return isFr ? "Livraison confirmee." : "Delivery confirmed.";
  if (status === "REJECTED") return isFr ? "Assignation refusee." : "Assignment declined.";
  if (status === "CANCELED") return isFr ? "Course annulee." : "Delivery canceled.";
  return status;
}

function serviceLabel(service: ServiceType, isFr: boolean) {
  const labelsFr: Record<ServiceType, string> = {
    ALL: "Tous",
    TIAK: "Tiak",
    SHOP: "Shop",
    PRESTA: "Presta",
    GP: "GP",
    IMMO: "Immo",
    CARS: "Cars",
  };

  const labelsEn: Record<ServiceType, string> = {
    ALL: "All",
    TIAK: "Tiak",
    SHOP: "Shop",
    PRESTA: "Presta",
    GP: "GP",
    IMMO: "Immo",
    CARS: "Cars",
  };

  return isFr ? labelsFr[service] : labelsEn[service];
}

function serviceIcon(service: Exclude<ServiceType, "ALL">) {
  switch (service) {
    case "TIAK":
      return "\u{1F6F5}";
    case "SHOP":
      return "\u{1F4E6}";
    case "PRESTA":
      return "\u{1F9D1}\u200D\u{1F527}";
    case "GP":
      return "\u{2708}\u{FE0F}";
    case "IMMO":
      return "\u{1F3E0}";
    case "CARS":
      return "\u{1F697}";
    default:
      return "\u{1F4AC}";
  }
}

function serviceChipClasses(service: Exclude<ServiceType, "ALL">) {
  switch (service) {
    case "TIAK":
      return "bg-emerald-400/15 border border-emerald-300/25 text-emerald-200";
    case "SHOP":
      return "bg-sky-400/15 border border-sky-300/25 text-sky-200";
    case "PRESTA":
      return "bg-violet-400/15 border border-violet-300/25 text-violet-200";
    case "GP":
      return "bg-amber-400/15 border border-amber-300/25 text-amber-200";
    case "IMMO":
      return "bg-cyan-400/15 border border-cyan-300/25 text-cyan-200";
    case "CARS":
      return "bg-rose-400/15 border border-rose-300/25 text-rose-200";
    default:
      return "bg-zinc-400/15 border border-zinc-300/25 text-zinc-200";
  }
}

export default function ConversationsList({
  locale,
  meId,
  conversations,
  inquiryConversations,
  initialSelectedId,
  initialQuickFilter = "ALL",
}: Props) {
  const isFr = locale === "fr";

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialSelectedId && conversations.some((entry) => entry.id === initialSelectedId)
      ? `tiak:${initialSelectedId}`
      : inquiryConversations[0]
        ? `shop:${inquiryConversations[0].id}`
        : conversations[0]
          ? `tiak:${conversations[0].id}`
          : null
  );
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialQuickFilter);
  const [serviceFilter, setServiceFilter] = useState<ServiceType>("ALL");
  const [visibleCount, setVisibleCount] = useState(20);
  const [manuallyReadTiak, setManuallyReadTiak] = useState<Record<string, true>>({});
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [opsDrawerOpen, setOpsDrawerOpen] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<TiakDelivery | null>(null);
  const [activeEvents, setActiveEvents] = useState<TiakDeliveryEvent[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const tiakUnreadById = useMemo(() => {
    const map = new Map<string, number>();
    for (const conversation of conversations) {
      const lastEvent = conversation.events[0];
      const unread = Boolean(lastEvent && lastEvent.actorId !== meId) && !manuallyReadTiak[conversation.id];
      map.set(conversation.id, unread ? 1 : 0);
    }
    return map;
  }, [conversations, manuallyReadTiak, meId]);

  const unifiedConversations = useMemo<UnifiedConversation[]>(() => {
    const tiakItems = conversations.map((item) => {
      const iAmCustomer = item.customerId === meId;
      const counterpart = iAmCustomer
        ? item.courier?.name || item.courier?.email || (isFr ? "Coursier" : "Courier")
        : item.customer?.name || item.customer?.email || (isFr ? "Client" : "Customer");
      const lastEvent = item.events[0] ?? null;
      const preview = lastEvent
        ? previewText({
            locale,
            meId,
            status: lastEvent.status,
            note: lastEvent.note,
            actorId: lastEvent.actorId,
            customerName: item.customer?.name || (isFr ? "Client" : "Customer"),
            courierName: item.courier?.name || (isFr ? "Coursier" : "Courier"),
          })
        : isFr
          ? "Aucun message"
          : "No messages";

      return {
        id: `tiak:${item.id}`,
        sourceId: item.id,
        kind: "TIAK" as const,
        serviceType: "TIAK" as const,
        title: `${toArea(item.pickupAddress)} -> ${toArea(item.dropoffAddress)}`,
        counterpart,
        preview,
        updatedAt: item.updatedAt,
        unreadCount: tiakUnreadById.get(item.id) ?? 0,
        statusRaw: item.status,
        statusLabel: formatTiakStatus(item.status, locale),
        isClosed: CLOSED_TIAK_STATUSES.has(item.status),
      };
    });

    const inquiryItems = inquiryConversations.map((item) => ({
      id: `shop:${item.id}`,
      sourceId: item.id,
      kind: "SHOP" as const,
      serviceType: item.serviceType,
      title: item.title,
      counterpart: item.counterpart,
      preview: item.preview,
      updatedAt: item.updatedAt,
      unreadCount: item.unread ? 1 : 0,
      statusRaw: item.status,
      statusLabel: formatInquiryStatus(item.status, locale),
      isClosed: item.status === "CLOSED",
      href: item.href,
    }));

    return [...tiakItems, ...inquiryItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations, inquiryConversations, isFr, locale, meId, tiakUnreadById]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();

    return unifiedConversations.filter((item) => {
      if (serviceFilter !== "ALL" && item.serviceType !== serviceFilter) return false;

      if (quickFilter === "UNREAD" && item.unreadCount === 0) return false;
      if (quickFilter === "OPEN" && item.isClosed) return false;
      if (quickFilter === "CLOSED" && !item.isClosed) return false;

      if (!q) return true;

      const haystack = [item.title, item.counterpart, item.preview, item.sourceId].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query, quickFilter, serviceFilter, unifiedConversations]);

  const availableServiceTabs = useMemo(() => {
    const presentTabs = new Set<ServiceType>(["ALL", serviceFilter]);

    for (const conversation of unifiedConversations) {
      presentTabs.add(conversation.serviceType);
    }

    return SERVICE_TABS.filter((service) => presentTabs.has(service));
  }, [serviceFilter, unifiedConversations]);

  const resolvedSelectedConversationId =
    selectedConversationId && filteredConversations.some((entry) => entry.id === selectedConversationId)
      ? selectedConversationId
      : (filteredConversations[0]?.id ?? null);

  const selectedConversation = useMemo(
    () => filteredConversations.find((entry) => entry.id === resolvedSelectedConversationId) ?? null,
    [filteredConversations, resolvedSelectedConversationId]
  );

  const selectedTiakConversation = useMemo(
    () =>
      selectedConversation?.kind === "TIAK"
        ? conversations.find((entry) => entry.id === selectedConversation.sourceId) ?? null
        : null,
    [conversations, selectedConversation]
  );

  const selectedShopInquiryId = useMemo(
    () => (selectedConversation?.kind === "SHOP" ? selectedConversation.sourceId : null),
    [selectedConversation]
  );
  const selectedShopConversation = useMemo(
    () =>
      selectedShopInquiryId
        ? inquiryConversations.find((entry) => entry.id === selectedShopInquiryId) ?? null
        : null,
    [inquiryConversations, selectedShopInquiryId]
  );

  const visibleConversations = filteredConversations.slice(0, visibleCount);
  const opsPanelOpen = selectedConversation?.kind === "TIAK" ? opsDrawerOpen : false;
  const opsPanelDelivery = selectedConversation?.kind === "TIAK" ? activeDelivery : null;
  const opsPanelEvents = selectedConversation?.kind === "TIAK" ? activeEvents : [];
  const opsPanelLoading = selectedConversation?.kind === "TIAK" ? threadLoading : false;

  const totalUnreadCount = useMemo(
    () => unifiedConversations.reduce((sum, item) => sum + item.unreadCount, 0),
    [unifiedConversations]
  );

  const markCurrentAsRead = () => {
    if (!selectedTiakConversation?.id) return;
    setManuallyReadTiak((current) => ({ ...current, [selectedTiakConversation.id]: true }));
  };

  const filterChipClasses = (value: QuickFilter) =>
    `rounded-full border px-3 py-1 text-[11px] font-medium transition ${
      quickFilter === value
        ? "border-emerald-300/70 bg-emerald-300/15 text-emerald-100"
        : "border-white/15 bg-zinc-900/65 text-zinc-300 hover:border-white/35"
    }`;

  const serviceTabClasses = (service: ServiceType) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      serviceFilter === service
        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
        : "bg-neutral-900/50 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
    }`;

  const activeServiceLabel = serviceLabel(serviceFilter, isFr);

  const shopSidebar = selectedShopConversation ? (
    <div className="space-y-4">
      <aside className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
          {selectedShopConversation.productImageUrl ? (
            <img
              src={selectedShopConversation.productImageUrl}
              alt={selectedShopConversation.productImageAlt}
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="grid h-44 place-items-center text-xs text-zinc-500">
              {isFr ? "Image indisponible" : "Image unavailable"}
            </div>
          )}
        </div>

        <p className="mt-4 text-sm font-semibold text-white">{selectedShopConversation.product.title}</p>

        <div className="mt-3 space-y-2 text-xs text-zinc-400">
          <p>{isFr ? "Messages" : "Messages"}: {selectedShopConversation.messagesCount}</p>
          <p>{isFr ? "Offres" : "Offers"}: {selectedShopConversation.offersCount}</p>
          <p>{isFr ? "Statut" : "Status"}: {selectedShopConversation.status === "OPEN" ? (isFr ? "Ouverte" : "Open") : (isFr ? "Fermee" : "Closed")}</p>
          <p>{isFr ? "Derniere activite" : "Last activity"}: {new Date(selectedShopConversation.lastActivityAt).toLocaleString(locale)}</p>
        </div>

        <div className="mt-4">
          <Link
            href={`/shop/${selectedShopConversation.product.slug}`}
            className="inline-flex rounded-full border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/70"
          >
            {isFr ? "Voir le produit" : "View product"}
          </Link>
        </div>
      </aside>

      <InquiryOffersPanel
        locale={locale}
        inquiryId={selectedShopConversation.id}
        meId={meId}
        isSeller={selectedShopConversation.isSeller}
        product={selectedShopConversation.product}
        sellerName={selectedShopConversation.sellerName}
        initialOffers={selectedShopConversation.initialOffers}
      />
    </div>
  ) : null;

  const listPanel = (
    <aside className="rounded-2xl border border-white/10 bg-zinc-900/55 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
      <div className="sticky top-0 z-10 rounded-xl border border-white/10 bg-zinc-950/95 p-3 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {availableServiceTabs.map((service) => (
            <button
              key={service}
              type="button"
              onClick={() => {
                setServiceFilter(service);
                setVisibleCount(20);
              }}
              className={serviceTabClasses(service)}
            >
              {serviceLabel(service, isFr)}
            </button>
          ))}
        </div>

        <label className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(20);
            }}
            placeholder={isFr ? "Rechercher trajet, nom, id..." : "Search route, name, id..."}
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/80 pl-10 pr-10 text-xs text-white outline-none transition focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/25"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-zinc-300"
              aria-label={isFr ? "Effacer" : "Clear"}
            >
              x
            </button>
          ) : null}
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setQuickFilter("UNREAD")} className={filterChipClasses("UNREAD")}>
            {isFr ? "Non lus" : "Unread"}
            {totalUnreadCount > 0 ? <span className="ml-1 text-emerald-200">{totalUnreadCount}</span> : null}
          </button>
          <button type="button" onClick={() => setQuickFilter("OPEN")} className={filterChipClasses("OPEN")}>
            {isFr ? "Ouvertes" : "Open"}
          </button>
          <button type="button" onClick={() => setQuickFilter("CLOSED")} className={filterChipClasses("CLOSED")}>
            {isFr ? "Fermees" : "Closed"}
          </button>
          <button type="button" onClick={() => setQuickFilter("ALL")} className={filterChipClasses("ALL")}>
            {isFr ? "Toutes" : "All"}
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{isFr ? "Conversations" : "Conversations"}</p>
          <span className="rounded-full border border-white/10 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-300">
            {activeServiceLabel} ({filteredConversations.length})
          </span>
        </div>

        <div className="space-y-2">
          {visibleConversations.map((item) => {
            const isSelected = item.id === resolvedSelectedConversationId;

            const rowClasses = `group block w-full rounded-xl border px-3 py-2.5 text-left transition ${
              isSelected
                ? "bg-neutral-800/50 border-emerald-400/30"
                : "border-white/10 bg-zinc-950/70 hover:bg-neutral-800/40"
            }`;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedConversationId(item.id);
                  setMobileView("chat");
                }}
                className={rowClasses}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${serviceChipClasses(item.serviceType)}`}>
                      <span aria-hidden>{serviceIcon(item.serviceType)}</span>
                      <span>{serviceLabel(item.serviceType, isFr)}</span>
                    </span>
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {new Date(item.updatedAt).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="mt-1 truncate text-xs text-zinc-400">
                  {item.counterpart} {" \u2022 "} {item.preview}
                </p>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                    {item.statusLabel}
                  </span>
                  {item.unreadCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-950/80" />
                      {item.unreadCount}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}

          {visibleConversations.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 text-xs text-zinc-500">
              {isFr
                ? `Aucune conversation ${activeServiceLabel} pour le moment.`
                : `No ${activeServiceLabel} conversations for now.`}
            </div>
          ) : null}
        </div>

        {filteredConversations.length > visibleCount ? (
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + 20)}
            className="mt-3 w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/35"
          >
            {isFr ? "Afficher plus (+20)" : "Load more (+20)"}
          </button>
        ) : null}
      </div>
    </aside>
  );

  return (
    <section className="mb-6 rounded-3xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">
          {isFr ? "Conversations" : "Conversations"}
        </h2>
        <span className="rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5 text-[11px] text-zinc-300">
          {unifiedConversations.length}
        </span>
      </div>

      <div className={`hidden gap-4 lg:grid ${selectedConversation?.kind === "TIAK" ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]" : "lg:grid-cols-[320px_minmax(0,1fr)]"}`}>
        {listPanel}

        {selectedConversation?.kind === "TIAK" ? (
          <ChatPanel
            locale={locale}
            meId={meId}
            deliveryId={selectedTiakConversation?.id ?? null}
            onThreadStateChange={(state) => {
              setActiveDelivery(state.delivery);
              setActiveEvents(state.events);
              setThreadLoading(state.loading);
            }}
            onOpenOps={() => setOpsDrawerOpen(true)}
            onMarkRead={markCurrentAsRead}
            onBackToList={undefined}
            refreshNonce={refreshNonce}
          />
        ) : selectedConversation?.kind === "SHOP" && selectedShopInquiryId && selectedShopConversation ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <InquiryChatThread
              key={selectedShopInquiryId}
              locale={locale}
              inquiryId={selectedShopInquiryId}
              meId={meId}
              initialMessages={[]}
            />
            {shopSidebar}
          </div>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4">
            <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-white/15 bg-zinc-950/60 text-center text-sm text-zinc-400">
              <p>{isFr ? "Selectionne une conversation." : "Select a conversation."}</p>
            </div>
          </section>
        )}

        {selectedConversation?.kind === "TIAK" ? (
          <div className="hidden xl:block">
            <OpsDetailsPanel
              locale={locale}
              mode="sidebar"
              open
              loading={opsPanelLoading}
              delivery={opsPanelDelivery}
              events={opsPanelEvents}
              onRefresh={() => {
                setRefreshNonce((current) => current + 1);
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4 lg:hidden">
        {mobileView === "list" ? (
          listPanel
        ) : selectedConversation?.kind === "TIAK" ? (
          <ChatPanel
            locale={locale}
            meId={meId}
            deliveryId={selectedTiakConversation?.id ?? null}
            onThreadStateChange={(state) => {
              setActiveDelivery(state.delivery);
              setActiveEvents(state.events);
              setThreadLoading(state.loading);
            }}
            onOpenOps={() => setOpsDrawerOpen(true)}
            onMarkRead={markCurrentAsRead}
            onBackToList={() => setMobileView("list")}
            refreshNonce={refreshNonce}
          />
        ) : selectedConversation?.kind === "SHOP" && selectedShopInquiryId && selectedShopConversation ? (
          <div className="space-y-4">
            <InquiryChatThread
              key={`mobile-${selectedShopInquiryId}`}
              locale={locale}
              inquiryId={selectedShopInquiryId}
              meId={meId}
              initialMessages={[]}
              onBackToList={() => setMobileView("list")}
            />
            {shopSidebar}
          </div>
        ) : (
          listPanel
        )}
      </div>

      <OpsDetailsPanel
        locale={locale}
        mode="drawer"
        open={opsPanelOpen}
        loading={opsPanelLoading}
        delivery={opsPanelDelivery}
        events={opsPanelEvents}
        onClose={() => setOpsDrawerOpen(false)}
        onRefresh={() => {
          setRefreshNonce((current) => current + 1);
        }}
      />
    </section>
  );
}
