"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type TiakDelivery } from "@/components/tiak/types";

type QueueTab = "ALL" | "REQUESTED" | "ASSIGNED" | "DELIVERED";
type SortKey = "NEWEST" | "OLDEST" | "PRICE_ASC" | "PRICE_DESC" | "STATUS";

const PAGE_SIZE = 20;

type Props = {
  locale: string;
  id?: string;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  deliveries: TiakDelivery[];
  emptyLabel: string;
  actionLabel?: string;
  onOpenDelivery: (delivery: TiakDelivery) => void;
};

function formatAmount(priceCents: number | null, currency: string) {
  if (priceCents === null) return "-";
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${priceCents} ${label}`;
}

function getPriceValue(priceCents: number | null) {
  return typeof priceCents === "number" ? priceCents : Number.POSITIVE_INFINITY;
}

function routeAccentClass(status: TiakDelivery["status"]) {
  if (status === "REQUESTED") return "border-l-4 border-l-sky-500/60";
  if (status === "ASSIGNED" || status === "ACCEPTED" || status === "PICKED_UP") {
    return "border-l-4 border-l-amber-500/60";
  }
  if (status === "DELIVERED" || status === "COMPLETED") {
    return "border-l-4 border-l-emerald-500/60";
  }
  if (status === "CANCELED" || status === "REJECTED") {
    return "border-l-4 border-l-rose-500/60";
  }
  return "border-l-4 border-l-white/20";
}

function statusBadgeClass(status: TiakDelivery["status"]) {
  if (status === "REQUESTED") return "border-sky-300/40 bg-sky-300/10 text-sky-200";
  if (status === "ASSIGNED" || status === "ACCEPTED" || status === "PICKED_UP") {
    return "border-amber-300/40 bg-amber-300/10 text-amber-200";
  }
  if (status === "DELIVERED" || status === "COMPLETED") {
    return "border-emerald-300/40 bg-emerald-300/10 text-emerald-200";
  }
  if (status === "CANCELED" || status === "REJECTED") {
    return "border-rose-300/40 bg-rose-300/10 text-rose-200";
  }
  return "border-white/20 bg-white/5 text-zinc-200";
}

function isPendingStatus(status: TiakDelivery["status"]) {
  return status === "REQUESTED" || status === "ASSIGNED" || status === "ACCEPTED" || status === "PICKED_UP";
}

function statusRank(status: TiakDelivery["status"]) {
  if (status === "REQUESTED") return 0;
  if (status === "ASSIGNED") return 1;
  if (status === "ACCEPTED") return 2;
  if (status === "PICKED_UP") return 3;
  if (status === "DELIVERED") return 4;
  if (status === "COMPLETED") return 5;
  if (status === "REJECTED") return 6;
  if (status === "CANCELED") return 7;
  return 99;
}

function formatAgeShort(createdAt: string, locale: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return "-";
  const now = Date.now();
  const diffMs = Math.max(0, now - created);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 60) {
    return locale === "fr" ? `${diffMinutes} min` : `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return locale === "fr" ? `${diffHours} h` : `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return locale === "fr" ? `${diffDays} j` : `${diffDays}d`;
}

export default function TiakDeliveryQueue({
  locale,
  id,
  title,
  subtitle,
  headerActions,
  deliveries,
  emptyLabel,
  actionLabel,
  onOpenDelivery,
}: Props) {
  const isFr = locale === "fr";
  const [activeTab, setActiveTab] = useState<QueueTab>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("NEWEST");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const tabs: Array<{ key: QueueTab; label: string }> = [
    { key: "ALL", label: isFr ? "Tous" : "All" },
    { key: "REQUESTED", label: isFr ? "En attente" : "Requested" },
    { key: "ASSIGNED", label: isFr ? "Assignees" : "Assigned" },
    { key: "DELIVERED", label: isFr ? "Livrees" : "Delivered" },
  ];

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "NEWEST", label: isFr ? "Plus recent" : "Newest" },
    { key: "OLDEST", label: isFr ? "Plus ancien" : "Oldest" },
    { key: "PRICE_ASC", label: isFr ? "Prix croissant" : "Price asc" },
    { key: "PRICE_DESC", label: isFr ? "Prix decroissant" : "Price desc" },
    { key: "STATUS", label: isFr ? "Statut" : "Status" },
  ];

  const filtered = useMemo(() => {
    let list = deliveries;

    if (activeTab === "REQUESTED") {
      list = list.filter((entry) => entry.status === "REQUESTED");
    } else if (activeTab === "ASSIGNED") {
      list = list.filter(
        (entry) =>
          entry.status === "ASSIGNED" ||
          entry.status === "ACCEPTED" ||
          entry.status === "PICKED_UP"
      );
    } else if (activeTab === "DELIVERED") {
      list = list.filter(
        (entry) => entry.status === "DELIVERED" || entry.status === "COMPLETED"
      );
    }

    if (pendingOnly) {
      list = list.filter((entry) => isPendingStatus(entry.status));
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch.length > 0) {
      list = list.filter((entry) => {
        const haystack = [
          entry.pickupArea,
          entry.dropoffArea,
          entry.id,
          entry.customer?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    const clone = [...list];
    clone.sort((a, b) => {
      if (sortKey === "NEWEST") {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (sortKey === "OLDEST") {
        return a.createdAt.localeCompare(b.createdAt);
      }
      if (sortKey === "PRICE_ASC") {
        return getPriceValue(a.priceCents) - getPriceValue(b.priceCents);
      }
      if (sortKey === "PRICE_DESC") {
        return getPriceValue(b.priceCents) - getPriceValue(a.priceCents);
      }
      return statusRank(a.status) - statusRank(b.status);
    });

    return clone;
  }, [activeTab, deliveries, pendingOnly, searchTerm, sortKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisibleCount(PAGE_SIZE), 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, pendingOnly, searchTerm, sortKey, deliveries.length]);

  const visibleDeliveries = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleDeliveries.length < filtered.length;

  return (
    <section
      id={id}
      className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-zinc-400">{subtitle}</p> : null}
        </div>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </div>

      <div className="mt-3 inline-flex flex-wrap rounded-full border border-white/10 bg-zinc-950/60 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200 ease-out motion-reduce:transition-none ${
              activeTab === tab.key
                ? "bg-emerald-300/15 text-emerald-100"
                : "text-zinc-300 hover:bg-zinc-800/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950/45 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_190px_auto] md:items-center">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isFr ? "Rechercher trajet, client, ID" : "Search route, customer, ID"}
              className="w-full rounded-full border border-white/15 bg-zinc-950/70 py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
            />
          </div>

          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-full border border-white/15 bg-zinc-950/70 px-4 py-2 text-sm text-white focus:border-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
            aria-label={isFr ? "Trier" : "Sort"}
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(event) => setPendingOnly(event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-zinc-900 text-emerald-400 focus:ring-emerald-400/40"
            />
            <span>{isFr ? "En attente uniquement" : "Pending only"}</span>
          </label>
        </div>

        <p className="mt-2 text-xs text-zinc-400">
          {isFr ? "Affiches" : "Shown"}: {visibleDeliveries.length} / {filtered.length}
        </p>
      </div>

      <div className="mt-4 max-h-[70vh] overflow-auto pr-1">
        <ul className="space-y-2">
          {visibleDeliveries.length === 0 ? (
            <li className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-400">
              {emptyLabel}
            </li>
          ) : (
            visibleDeliveries.map((delivery) => (
              <li key={delivery.id}>
                <button
                  type="button"
                  onClick={() => onOpenDelivery(delivery)}
                  className={`group h-[72px] w-full rounded-xl border border-neutral-800/70 bg-neutral-900/40 px-3 text-left transition-all duration-200 ease-out hover:border-emerald-300/30 hover:bg-neutral-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 motion-reduce:transition-none ${routeAccentClass(
                    delivery.status
                  )}`}
                  aria-label={`${isFr ? "Voir les details" : "Open details"} ${delivery.id}`}
                >
                  <div className="grid h-full grid-cols-[1fr_auto] items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-100 md:text-base">
                        <span className="max-w-[42%] truncate">{delivery.pickupArea}</span>
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <span className="h-[1px] w-6 bg-zinc-600 transition-colors duration-200 group-hover:bg-emerald-300/40 motion-reduce:transition-none" />
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                            aria-hidden="true"
                          >
                            <path d="M5 12h13" />
                            <path d="m13 6 6 6-6 6" />
                          </svg>
                        </span>
                        <span className="max-w-[42%] truncate">{delivery.dropoffArea}</span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                        <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 font-medium tabular-nums text-emerald-100">
                          {formatAmount(delivery.priceCents, delivery.currency)}
                        </span>
                        <span className="inline-flex rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5">
                          {delivery.paymentMethod ?? "-"}
                        </span>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 ${statusBadgeClass(delivery.status)}`}>
                          {delivery.status}
                        </span>
                        <span className="tabular-nums text-zinc-400">{formatAgeShort(delivery.createdAt, locale)}</span>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-zinc-950/70 px-3 py-1 text-xs font-semibold text-zinc-100">
                      {actionLabel ?? (isFr ? "Details" : "Details")}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {hasMore ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
            className="rounded-full border border-white/20 bg-zinc-950/65 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
          >
            {isFr ? "Charger plus (+20)" : "Load more (+20)"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
