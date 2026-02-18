"use client";

import { useMemo, useState } from "react";
import TiakCourierActions from "@/components/tiak/TiakCourierActions";
import TiakDeliveryDetails from "@/components/tiak/TiakDeliveryDetails";
import { type TiakDelivery } from "@/components/tiak/types";

type Props = {
  locale: string;
  delivery: TiakDelivery;
  isLoggedIn: boolean;
  currentUserId: string | null;
  currentUserRole: string | null;
  onDeliveryUpdated: (delivery: TiakDelivery) => void;
  onTrackDelivery: (id: string) => void;
  onRequireLogin: () => void;
};

function formatAmount(priceCents: number | null, currency: string) {
  if (priceCents === null) return "-";
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${priceCents} ${label}`;
}

function contactHintLabel(locale: string, paymentMethod: string | null) {
  const isCash = paymentMethod === "CASH";
  if (locale === "fr") {
    return isCash
      ? "Contact disponible apres ACCEPTED"
      : "Contact disponible apres ACCEPTED + paiement";
  }

  return isCash
    ? "Contact available after ACCEPTED"
    : "Contact available after ACCEPTED + payment";
}

export default function TiakDeliveryCard({
  locale,
  delivery,
  isLoggedIn,
  currentUserId,
  currentUserRole,
  onDeliveryUpdated,
  onTrackDelivery,
  onRequireLogin,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [customerActionLoading, setCustomerActionLoading] = useState(false);
  const [customerActionError, setCustomerActionError] = useState<string | null>(null);

  const isCustomerOwner = Boolean(currentUserId && currentUserId === delivery.customerId);
  const canCancel = isCustomerOwner && delivery.status === "REQUESTED";
  const canComplete = isCustomerOwner && delivery.status === "DELIVERED";

  const statusClass = useMemo(() => {
    if (delivery.status === "REQUESTED") return "border-sky-300/40 bg-sky-300/10 text-sky-200";
    if (delivery.status === "ACCEPTED") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-200";
    if (delivery.status === "PICKED_UP") return "border-amber-300/40 bg-amber-300/10 text-amber-200";
    if (delivery.status === "DELIVERED") return "border-violet-300/40 bg-violet-300/10 text-violet-200";
    if (delivery.status === "COMPLETED") return "border-emerald-200/40 bg-emerald-200/10 text-emerald-100";
    if (delivery.status === "CANCELED" || delivery.status === "REJECTED") {
      return "border-rose-300/40 bg-rose-300/10 text-rose-200";
    }
    return "border-white/20 bg-white/5 text-zinc-200";
  }, [delivery.status]);

  async function patchCustomerStatus(status: "CANCELED" | "COMPLETED") {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setCustomerActionLoading(true);
    setCustomerActionError(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCustomerActionError(
          typeof data?.error === "string"
            ? data.error
            : locale === "fr"
              ? "Action refusee"
              : "Action denied"
        );
        return;
      }

      onTrackDelivery(delivery.id);
      onDeliveryUpdated(data as TiakDelivery);
    } catch {
      setCustomerActionError(locale === "fr" ? "Action refusee" : "Action denied");
    } finally {
      setCustomerActionLoading(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">
            {delivery.pickupArea} -&gt; {delivery.dropoffArea}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">#{delivery.id.slice(0, 8)}</p>
        </div>
        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass}`}>
          {delivery.status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-300 md:grid-cols-2">
        <p>
          <span className="text-zinc-500">{locale === "fr" ? "Tarif" : "Price"}:</span>{" "}
          {formatAmount(delivery.priceCents, delivery.currency)}
        </p>
        <p>
          <span className="text-zinc-500">{locale === "fr" ? "Paiement" : "Payment"}:</span>{" "}
          {delivery.paymentMethod ?? "-"}
        </p>
        <p>
          <span className="text-zinc-500">Customer:</span> {delivery.customer?.name ?? "-"}
        </p>
        <p>
          <span className="text-zinc-500">Courier:</span> {delivery.courier?.name ?? "-"}
        </p>
      </div>

      {delivery.note && <p className="mt-2 text-xs text-zinc-300">{delivery.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onTrackDelivery(delivery.id);
            setDetailsOpen(true);
          }}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-100"
        >
          {locale === "fr" ? "Voir details" : "View details"}
        </button>

        {canCancel && (
          <button
            type="button"
            onClick={() => patchCustomerStatus("CANCELED")}
            disabled={customerActionLoading}
            className="rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-60"
          >
            {locale === "fr" ? "Annuler" : "Cancel"}
          </button>
        )}

        {canComplete && (
          <button
            type="button"
            onClick={() => patchCustomerStatus("COMPLETED")}
            disabled={customerActionLoading}
            className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-60"
          >
            {locale === "fr" ? "Confirmer reception" : "Confirm received"}
          </button>
        )}
      </div>

      {customerActionError && <p className="mt-2 text-xs text-rose-300">{customerActionError}</p>}

      <TiakCourierActions
        locale={locale}
        delivery={delivery}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onDeliveryUpdated={(updated) => {
          onTrackDelivery(updated.id);
          onDeliveryUpdated(updated);
        }}
      />

      {!delivery.canContact && (
        <p className="mt-2 text-[11px] text-zinc-500">
          {contactHintLabel(locale, delivery.paymentMethod)}
        </p>
      )}

      <TiakDeliveryDetails
        locale={locale}
        deliveryId={delivery.id}
        open={detailsOpen}
        isLoggedIn={isLoggedIn}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onClose={() => setDetailsOpen(false)}
        onDeliveryLoaded={(loaded) => onDeliveryUpdated(loaded)}
      />
    </article>
  );
}

