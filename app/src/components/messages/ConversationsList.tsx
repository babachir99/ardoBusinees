"use client";

import { useEffect, useMemo, useState } from "react";
import type { TiakDelivery, TiakDeliveryEvent } from "@/components/tiak/types";
import ChatPanel from "@/components/messages/ChatPanel";
import OpsDetailsPanel from "@/components/messages/OpsDetailsPanel";

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

type Props = {
  locale: string;
  meId: string;
  conversations: TiakConversationSummary[];
  initialSelectedId: string | null;
};

type QuickFilter = "ALL" | "UNREAD" | "OPEN" | "CLOSED";

const CLOSED_STATUSES = new Set(["COMPLETED", "CANCELED", "REJECTED"]);
const SYSTEM_NOTES = new Set([
  "Courier assigned",
  "Courier accepted assignment",
  "Courier declined assignment",
  "Assignment expired",
]);

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

function formatStatus(status: string, locale: string) {
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

export default function ConversationsList({
  locale,
  meId,
  conversations,
  initialSelectedId,
}: Props) {
  const isFr = locale === "fr";
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && conversations.some((entry) => entry.id === initialSelectedId)
      ? initialSelectedId
      : (conversations[0]?.id ?? null)
  );
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [visibleCount, setVisibleCount] = useState(20);
  const [manuallyRead, setManuallyRead] = useState<Record<string, true>>({});
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [opsDrawerOpen, setOpsDrawerOpen] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<TiakDelivery | null>(null);
  const [activeEvents, setActiveEvents] = useState<TiakDeliveryEvent[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const unreadById = useMemo(() => {
    const map = new Map<string, number>();
    for (const conversation of conversations) {
      const lastEvent = conversation.events[0];
      const unread =
        Boolean(lastEvent && lastEvent.actorId !== meId) && !manuallyRead[conversation.id];
      map.set(conversation.id, unread ? 1 : 0);
    }
    return map;
  }, [conversations, manuallyRead, meId]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();

    return conversations.filter((item) => {
      const isUnread = (unreadById.get(item.id) ?? 0) > 0;
      const isClosed = CLOSED_STATUSES.has(item.status);

      if (quickFilter === "UNREAD" && !isUnread) return false;
      if (quickFilter === "OPEN" && isClosed) return false;
      if (quickFilter === "CLOSED" && !isClosed) return false;

      if (!q) return true;

      const counterpart =
        item.customerId === meId
          ? item.courier?.name || item.courier?.email || ""
          : item.customer?.name || item.customer?.email || "";

      const haystack = [
        toArea(item.pickupAddress),
        toArea(item.dropoffAddress),
        counterpart,
        item.id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [conversations, meId, query, quickFilter, unreadById]);

  const selectedConversation = useMemo(
    () => conversations.find((entry) => entry.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    if (!selectedId || !conversations.some((entry) => entry.id === selectedId)) {
      setSelectedId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedId]);

  const visibleConversations = filteredConversations.slice(0, visibleCount);

  const unreadCount = useMemo(
    () => Array.from(unreadById.values()).reduce((sum, value) => sum + value, 0),
    [unreadById]
  );

  const markCurrentAsRead = () => {
    if (!selectedId) return;
    setManuallyRead((current) => ({ ...current, [selectedId]: true }));
  };

  const filterChipClasses = (value: QuickFilter) =>
    `rounded-full border px-3 py-1 text-[11px] font-medium transition ${
      quickFilter === value
        ? "border-emerald-300/70 bg-emerald-300/15 text-emerald-100"
        : "border-white/15 bg-zinc-900/65 text-zinc-300 hover:border-white/35"
    }`;

  const listPanel = (
    <aside className="rounded-2xl border border-white/10 bg-zinc-900/55 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
      <div className="sticky top-0 z-10 rounded-xl border border-white/10 bg-zinc-950/95 p-3 backdrop-blur">
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
            {unreadCount > 0 ? <span className="ml-1 text-emerald-200">{unreadCount}</span> : null}
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

      <div className="mt-3 max-h-[68vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          {visibleConversations.map((item) => {
            const isSelected = item.id === selectedId;
            const isUnread = (unreadById.get(item.id) ?? 0) > 0;
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

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setMobileView("chat");
                }}
                className={`group w-full rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out motion-reduce:transform-none ${
                  isSelected
                    ? "border-emerald-300/50 bg-zinc-800/40 shadow-[0_0_20px_rgba(16,185,129,0.14)]"
                    : "border-white/10 bg-zinc-950/70 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {toArea(item.pickupAddress)} -&gt; {toArea(item.dropoffAddress)}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    {isUnread ? <span className="h-2 w-2 rounded-full bg-emerald-300" /> : null}
                    <span>{new Date(item.updatedAt).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

                <p className="mt-0.5 truncate text-[11px] text-zinc-400">{counterpart}</p>
                <p className={`mt-1 truncate text-xs ${isUnread ? "text-zinc-200" : "text-zinc-500"}`}>{preview}</p>

                <div className="mt-2 flex items-center justify-between">
                  <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                    {formatStatus(item.status, locale)}
                  </span>
                  {isUnread ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">
                      1
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}

          {visibleConversations.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 text-xs text-zinc-500">
              {isFr ? "Aucune conversation avec ces filtres." : "No conversations for this filter."}
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
          {isFr ? "Conversations TIAK" : "TIAK conversations"}
        </h2>
        <span className="rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5 text-[11px] text-zinc-300">
          {conversations.length}
        </span>
      </div>

      <div className="hidden gap-4 lg:grid xl:grid-cols-[320px_minmax(0,1fr)_320px] lg:grid-cols-[320px_minmax(0,1fr)]">
        {listPanel}

        <ChatPanel
          locale={locale}
          meId={meId}
          deliveryId={selectedConversation?.id ?? null}
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

        <div className="hidden xl:block">
          <OpsDetailsPanel
            locale={locale}
            mode="sidebar"
            open
            loading={threadLoading}
            delivery={activeDelivery}
            events={activeEvents}
            onRefresh={() => {
              setRefreshNonce((current) => current + 1);
            }}
          />
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {mobileView === "list" ? (
          listPanel
        ) : (
          <ChatPanel
            locale={locale}
            meId={meId}
            deliveryId={selectedConversation?.id ?? null}
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
        )}
      </div>

      <OpsDetailsPanel
        locale={locale}
        mode="drawer"
        open={opsDrawerOpen}
        loading={threadLoading}
        delivery={activeDelivery}
        events={activeEvents}
        onClose={() => setOpsDrawerOpen(false)}
        onRefresh={() => {
          setRefreshNonce((current) => current + 1);
        }}
      />
    </section>
  );
}
