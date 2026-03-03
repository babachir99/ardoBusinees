"use client";

import { useMemo, useState } from "react";
import { type TiakDelivery } from "@/components/tiak/types";

type QueueTab = "ALL" | "REQUESTED" | "ASSIGNED" | "DELIVERED";

type Props = {
  locale: string;
  id?: string;
  title: string;
  subtitle?: string;
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

export default function TiakDeliveryQueue({
  locale,
  id,
  title,
  subtitle,
  deliveries,
  emptyLabel,
  actionLabel,
  onOpenDelivery,
}: Props) {
  const isFr = locale === "fr";
  const [activeTab, setActiveTab] = useState<QueueTab>("ALL");

  const tabs: Array<{ key: QueueTab; label: string }> = [
    { key: "ALL", label: isFr ? "Tous" : "All" },
    { key: "REQUESTED", label: isFr ? "En attente" : "Requested" },
    { key: "ASSIGNED", label: isFr ? "Assignees" : "Assigned" },
    { key: "DELIVERED", label: isFr ? "Livrees" : "Delivered" },
  ];

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return deliveries;
    if (activeTab === "REQUESTED") {
      return deliveries.filter((entry) => entry.status === "REQUESTED");
    }
    if (activeTab === "ASSIGNED") {
      return deliveries.filter(
        (entry) =>
          entry.status === "ASSIGNED" ||
          entry.status === "ACCEPTED" ||
          entry.status === "PICKED_UP"
      );
    }
    return deliveries.filter(
      (entry) => entry.status === "DELIVERED" || entry.status === "COMPLETED"
    );
  }, [activeTab, deliveries]);

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

      <ul className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-400">
            {emptyLabel}
          </li>
        ) : (
          filtered.map((delivery) => (
            <li key={delivery.id}>
              <button
                type="button"
                onClick={() => onOpenDelivery(delivery)}
                className={`group w-full rounded-xl border border-neutral-800/70 bg-neutral-900/40 px-4 py-4 text-left transition-all duration-200 ease-out hover:border-emerald-300/30 hover:bg-neutral-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 motion-reduce:transition-none ${routeAccentClass(
                  delivery.status
                )}`}
                aria-label={`${isFr ? "Voir les details" : "Open details"} ${delivery.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="max-w-[36%] truncate rounded-full border border-white/15 bg-zinc-950/75 px-3 py-1 text-sm font-semibold text-zinc-100 md:text-base">
                        {delivery.pickupArea}
                      </span>

                      <span className="relative inline-flex items-center">
                        <span className="h-[2px] w-10 rounded-full bg-zinc-600 transition-colors duration-200 group-hover:bg-emerald-300/40 motion-reduce:transition-none" />
                        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/70 animate-pulse motion-reduce:animate-none" />
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="ml-1 h-4 w-4 text-zinc-300 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                          aria-hidden="true"
                        >
                          <path d="M5 12h13" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </span>

                      <span className="max-w-[36%] truncate rounded-full border border-white/15 bg-zinc-950/75 px-3 py-1 text-sm font-semibold text-zinc-100 md:text-base">
                        {delivery.dropoffArea}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium tabular-nums text-emerald-100">
                        {formatAmount(delivery.priceCents, delivery.currency)}
                      </span>
                      <span className="inline-flex rounded-full border border-white/15 bg-zinc-950/70 px-2.5 py-1 text-xs text-zinc-200">
                        {delivery.paymentMethod ?? "-"}
                      </span>
                      <span className="max-w-[220px] truncate text-xs text-zinc-500">#{delivery.id}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`hidden rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${statusBadgeClass(delivery.status)}`}>
                      {delivery.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-zinc-950/70 px-3 py-1 text-xs font-semibold text-zinc-100">
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
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
