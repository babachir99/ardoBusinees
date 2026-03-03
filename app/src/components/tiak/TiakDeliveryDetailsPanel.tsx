"use client";

import { useEffect } from "react";
import TiakDeliveryCard from "@/components/tiak/TiakDeliveryCard";
import { type TiakDelivery } from "@/components/tiak/types";

type Props = {
  locale: string;
  open: boolean;
  delivery: TiakDelivery | null;
  isLoggedIn: boolean;
  currentUserId: string | null;
  currentUserRole: string | null;
  onClose: () => void;
  onTrackDelivery: (id: string) => void;
  onDeliveryUpdated: (delivery: TiakDelivery) => void;
  onRequireLogin: () => void;
};

function formatAmount(priceCents: number | null, currency: string) {
  if (priceCents === null) return "-";
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${priceCents} ${label}`;
}

export default function TiakDeliveryDetailsPanel({
  locale,
  open,
  delivery,
  isLoggedIn,
  currentUserId,
  currentUserRole,
  onClose,
  onTrackDelivery,
  onDeliveryUpdated,
  onRequireLogin,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || !delivery) return null;

  const isFr = locale === "fr";

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isFr ? "Details livraison" : "Delivery details"}
        className="absolute inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-[0_-18px_45px_rgba(0,0,0,0.5)] lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[620px] lg:rounded-none lg:border-l"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{isFr ? "Panneau details" : "Details panel"}</p>
            <h3 className="mt-1 text-base font-semibold text-white">
              {delivery.pickupArea} -&gt; {delivery.dropoffArea}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">#{delivery.id.slice(0, 10)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-100 transition hover:border-white/50"
          >
            {isFr ? "Fermer" : "Close"}
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto pb-2 pr-1 lg:max-h-[calc(100vh-96px)]">
          <section className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-zinc-500">{isFr ? "Tarif" : "Price"}:</span> {formatAmount(delivery.priceCents, delivery.currency)}
              </p>
              <p>
                <span className="text-zinc-500">{isFr ? "Paiement" : "Payment"}:</span> {delivery.paymentMethod ?? "-"}
              </p>
              <p>
                <span className="text-zinc-500">{isFr ? "Client" : "Customer"}:</span> {delivery.customer?.name ?? "-"}
              </p>
              <p>
                <span className="text-zinc-500">{isFr ? "Coursier" : "Courier"}:</span> {delivery.courier?.name ?? "-"}
              </p>
            </div>
          </section>

          <TiakDeliveryCard
            locale={locale}
            delivery={delivery}
            isLoggedIn={isLoggedIn}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onTrackDelivery={onTrackDelivery}
            onDeliveryUpdated={onDeliveryUpdated}
            onRequireLogin={onRequireLogin}
          />
        </div>
      </aside>
    </div>
  );
}
