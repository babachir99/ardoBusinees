"use client";

import { useMemo, useState } from "react";
import type { TiakDelivery, TiakDeliveryEvent } from "@/components/tiak/types";

type Props = {
  locale: string;
  mode: "sidebar" | "drawer";
  open: boolean;
  loading: boolean;
  delivery: TiakDelivery | null;
  events: TiakDeliveryEvent[];
  onClose?: (() => void) | undefined;
  onRefresh?: (() => void) | undefined;
};

const STATUS_FLOW = ["REQUESTED", "ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED"];

function statusLabel(status: string, locale: string) {
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

function formatAmount(priceCents: number | null, currency: string) {
  if (priceCents === null) return "-";
  return `${priceCents} ${currency === "XOF" ? "FCFA" : currency}`;
}

function OpsPanelContent({ locale, loading, delivery, events, onRefresh }: Omit<Props, "mode" | "open" | "onClose">) {
  const isFr = locale === "fr";
  const [collapsed, setCollapsed] = useState(false);

  const reachedStatuses = useMemo(() => {
    const reached = new Set<string>();
    for (const event of events) {
      reached.add(event.status);
    }
    if (delivery?.status) reached.add(delivery.status);
    return reached;
  }, [delivery?.status, events]);

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-left"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Details course" : "Delivery ops"}</p>
          <p className="mt-1 text-sm font-semibold text-white">{delivery ? statusLabel(delivery.status, locale) : "-"}</p>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${collapsed ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {!collapsed ? (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="space-y-2">
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
            </div>
          ) : !delivery ? (
            <div className="rounded-xl border border-white/10 bg-zinc-950/65 p-3 text-xs text-zinc-500">
              {isFr ? "Selectionne une conversation." : "Select a conversation."}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-zinc-950/65 p-3 text-xs text-zinc-300">
                <p><span className="text-zinc-500">ID:</span> #{delivery.id.slice(0, 10)}</p>
                <p className="mt-1"><span className="text-zinc-500">{isFr ? "Prix" : "Price"}:</span> {formatAmount(delivery.priceCents, delivery.currency)}</p>
                <p className="mt-1"><span className="text-zinc-500">{isFr ? "Paiement" : "Payment"}:</span> {delivery.paymentMethod ?? "-"}</p>
                <p className="mt-1"><span className="text-zinc-500">{isFr ? "Client" : "Customer"}:</span> {delivery.customer?.name ?? "-"}</p>
                <p className="mt-1"><span className="text-zinc-500">{isFr ? "Coursier" : "Courier"}:</span> {delivery.courier?.name ?? "-"}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-950/65 p-3">
                <p className="text-xs font-semibold text-zinc-200">{isFr ? "Timeline" : "Timeline"}</p>
                <div className="mt-2 space-y-2">
                  {STATUS_FLOW.map((status, index) => {
                    const done = reachedStatuses.has(status);
                    const isCurrent = delivery.status === status;
                    return (
                      <div key={status} className="flex items-center gap-2 text-xs">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${done ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-100" : "border-white/20 text-zinc-500"}`}>
                          {done ? "✓" : index + 1}
                        </span>
                        <span className={isCurrent ? "text-white" : "text-zinc-400"}>{statusLabel(status, locale)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`/stores/jontaado-tiak-tiak?deliveryId=${encodeURIComponent(delivery.id)}`}
                  className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60"
                >
                  {isFr ? "Ouvrir ops" : "Open ops"}
                </a>
                <button
                  type="button"
                  onClick={() => onRefresh?.()}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-200 transition hover:border-white/40"
                >
                  {isFr ? "Rafraichir" : "Refresh"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function OpsDetailsPanel({
  mode,
  open,
  onClose,
  ...rest
}: Props) {
  if (mode === "sidebar") {
    return <OpsPanelContent {...rest} />;
  }

  return (
    <div className={`fixed inset-0 z-[70] ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
        onClick={() => onClose?.()}
      />

      <aside
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 right-0 w-[92vw] max-w-[360px] border-l border-white/10 bg-zinc-950/95 p-3 shadow-[0_0_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{rest.locale === "fr" ? "Details / Ops" : "Details / Ops"}</p>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-full border border-white/15 px-2 py-1 text-xs text-zinc-200"
          >
            {rest.locale === "fr" ? "Fermer" : "Close"}
          </button>
        </div>
        <OpsPanelContent {...rest} />
      </aside>
    </div>
  );
}
