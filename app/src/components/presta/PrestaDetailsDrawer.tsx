"use client";

import { useEffect } from "react";

type OfferDetails = {
  kind: "offer";
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  city: string | null;
  createdAt: string | null;
  statusLabel: string;
  priceLabel: string;
  providerName: string;
  paymentMethods: string[];
};

type NeedDetails = {
  kind: "need";
  id: string;
  title: string;
  description: string;
  city: string | null;
  area: string | null;
  createdAt: string;
  preferredDate: string | null;
  statusLabel: string;
  budgetLabel: string;
  customerName: string;
};

export type PrestaDetailsItem = OfferDetails | NeedDetails;

type Props = {
  locale: string;
  open: boolean;
  item: PrestaDetailsItem | null;
  onClose: () => void;
  onBook?: () => void;
  onViewProfile?: () => void;
  onNeedPrimaryAction?: () => void;
};

function sectionTitle(label: string) {
  return <h4 className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</h4>;
}

export default function PrestaDetailsDrawer({
  locale,
  open,
  item,
  onClose,
  onBook,
  onViewProfile,
  onNeedPrimaryAction,
}: Props) {
  const isFr = locale === "fr";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        aria-label={isFr ? "Fermer les details" : "Close details"}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-white/10 bg-zinc-950/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.kind === "offer" ? "Offre" : isFr ? "Besoin" : "Need"}</p>
              <h3 className="mt-1 text-xl font-semibold text-white">{item.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200 transition hover:border-white/40"
            >
              {isFr ? "Fermer" : "Close"}
            </button>
          </div>

          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              {sectionTitle(isFr ? "Description" : "Description")}
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {item.description?.trim() || (isFr ? "Aucune description." : "No description.")}
              </p>
            </section>

            {item.kind === "offer" ? (
              <>
                <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                  {sectionTitle(isFr ? "Service" : "Service")}
                  <div className="mt-2 grid gap-2 text-sm text-zinc-300">
                    <p><span className="text-zinc-500">{isFr ? "Statut" : "Status"}:</span> {item.statusLabel}</p>
                    <p><span className="text-zinc-500">{isFr ? "Prix" : "Price"}:</span> {item.priceLabel}</p>
                    <p><span className="text-zinc-500">{isFr ? "Categorie" : "Category"}:</span> {item.category ?? "-"}</p>
                    <p><span className="text-zinc-500">{isFr ? "Zone" : "Area"}:</span> {item.city ?? "-"}</p>
                    <p><span className="text-zinc-500">{isFr ? "Cree le" : "Created"}:</span> {item.createdAt ?? "-"}</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                  {sectionTitle(isFr ? "Prestataire" : "Provider")}
                  <p className="mt-2 text-sm text-zinc-200">{item.providerName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.paymentMethods.join(", ") || "-"}</p>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                  {sectionTitle(isFr ? "Besoin" : "Need")}
                  <div className="mt-2 grid gap-2 text-sm text-zinc-300">
                    <p><span className="text-zinc-500">{isFr ? "Statut" : "Status"}:</span> {item.statusLabel}</p>
                    <p><span className="text-zinc-500">{isFr ? "Budget" : "Budget"}:</span> {item.budgetLabel}</p>
                    <p><span className="text-zinc-500">{isFr ? "Zone" : "Area"}:</span> {item.city ?? item.area ?? "-"}</p>
                    <p><span className="text-zinc-500">{isFr ? "Date souhaitee" : "Preferred date"}:</span> {item.preferredDate ?? "-"}</p>
                    <p><span className="text-zinc-500">{isFr ? "Publie le" : "Published"}:</span> {item.createdAt}</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                  {sectionTitle(isFr ? "Client" : "Customer")}
                  <p className="mt-2 text-sm text-zinc-200">{item.customerName}</p>
                </section>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {item.kind === "offer" ? (
              <>
                <button
                  type="button"
                  onClick={onBook}
                  className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
                >
                  {isFr ? "Reserver" : "Book"}
                </button>
                <button
                  type="button"
                  onClick={onViewProfile}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/40"
                >
                  {isFr ? "Voir profil" : "View profile"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onNeedPrimaryAction}
                className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/65"
              >
                {isFr ? "Voir services" : "View services"}
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
