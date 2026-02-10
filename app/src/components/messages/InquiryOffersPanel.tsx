"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";

type OfferItem = {
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

type InquiryOffersPanelProps = {
  locale: string;
  inquiryId: string;
  meId: string;
  isSeller: boolean;
  product: {
    id: string;
    slug: string;
    title: string;
    type: "PREORDER" | "DROPSHIP" | "LOCAL";
    currency: string;
  };
  sellerName?: string;
  initialOffers: OfferItem[];
};

const statusColor: Record<OfferItem["status"], string> = {
  PENDING: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  ACCEPTED: "border-emerald-300/50 bg-emerald-300/10 text-emerald-100",
  REJECTED: "border-rose-300/40 bg-rose-300/10 text-rose-100",
  CANCELED: "border-zinc-400/30 bg-zinc-400/10 text-zinc-200",
  EXPIRED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

export default function InquiryOffersPanel({
  locale,
  inquiryId,
  meId,
  isSeller,
  product,
  sellerName,
  initialOffers,
}: InquiryOffersPanelProps) {
  const isFr = locale === "fr";
  const [offers, setOffers] = useState(initialOffers);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();
  const router = useRouter();

  const labels = useMemo(
    () => ({
      title: isFr ? "Offres" : "Offers",
      subtitle: isFr
        ? "Negociation depuis la conversation"
        : "Negotiate directly in chat",
      amount: isFr ? "Montant" : "Amount",
      quantity: isFr ? "Quantite" : "Quantity",
      note: isFr ? "Note (optionnelle)" : "Note (optional)",
      create: isFr ? "Envoyer une offre" : "Send offer",
      accept: isFr ? "Accepter" : "Accept",
      reject: isFr ? "Refuser" : "Reject",
      cancel: isFr ? "Annuler" : "Cancel",
      payOffer: isFr ? "Payer cette offre" : "Pay this offer",
      empty: isFr ? "Aucune offre pour le moment." : "No offers yet.",
      pending: isFr ? "En attente" : "Pending",
      accepted: isFr ? "Acceptee" : "Accepted",
      rejected: isFr ? "Refusee" : "Rejected",
      canceled: isFr ? "Annulee" : "Canceled",
      expired: isFr ? "Expiree" : "Expired",
    }),
    [isFr]
  );

  const statusLabel = (status: OfferItem["status"]) => {
    if (status === "PENDING") return labels.pending;
    if (status === "ACCEPTED") return labels.accepted;
    if (status === "REJECTED") return labels.rejected;
    if (status === "CANCELED") return labels.canceled;
    return labels.expired;
  };

  const refreshOffers = async () => {
    const res = await fetch(`/api/inquiries/${inquiryId}/offers`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as OfferItem[];
    setOffers(data);
  };

  const createOffer = async () => {
    const amountMajor = Number(amount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      setError(isFr ? "Montant invalide" : "Invalid amount");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(amountMajor * 100),
          quantity,
          note,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || (isFr ? "Echec de l'offre" : "Offer failed"));
      }

      setAmount("");
      setNote("");
      await refreshOffers();
    } catch (e) {
      setError(e instanceof Error ? e.message : isFr ? "Erreur" : "Error");
    } finally {
      setLoading(false);
    }
  };

  const actOnOffer = async (
    offerId: string,
    action: "ACCEPT" | "REJECT" | "CANCEL"
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || (isFr ? "Action impossible" : "Action failed"));
      }

      await refreshOffers();
    } catch (e) {
      setError(e instanceof Error ? e.message : isFr ? "Erreur" : "Error");
    } finally {
      setLoading(false);
    }
  };

  const checkoutAcceptedOffer = (offer: OfferItem) => {
    addItem(
      {
        id: product.id,
        slug: product.slug,
        title: product.title,
        priceCents: offer.amountCents,
        currency: offer.currency || product.currency,
        type: product.type,
        sellerName,
        offerId: offer.id,
      },
      offer.quantity
    );

    router.push(`/${locale}/checkout`);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
          {labels.title}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{labels.subtitle}</p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
        <label className="text-xs text-zinc-400">{labels.amount}</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={isFr ? "ex: 25000" : "e.g. 25000"}
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />

        <label className="text-xs text-zinc-400">{labels.quantity}</label>
        <input
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
          }
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />

        <label className="text-xs text-zinc-400">{labels.note}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />

        <button
          type="button"
          onClick={createOffer}
          disabled={loading}
          className="mt-1 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {labels.create}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

      <div className="mt-4 space-y-2">
        {offers.length === 0 ? (
          <p className="text-xs text-zinc-500">{labels.empty}</p>
        ) : (
          offers.map((offer) => {
            const isMine = offer.buyerId === meId;
            const canAcceptReject = isSeller && offer.status === "PENDING";
            const canCancel = isMine && offer.status === "PENDING";
            const canCheckout = isMine && offer.status === "ACCEPTED";

            return (
              <div
                key={offer.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/70 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {formatMoney(offer.amountCents, offer.currency, locale)} x{offer.quantity}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {new Date(offer.createdAt).toLocaleString(locale)}
                    </p>
                    {offer.note ? (
                      <p className="mt-2 text-xs text-zinc-300">{offer.note}</p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor[offer.status]}`}
                  >
                    {statusLabel(offer.status)}
                  </span>
                </div>

                {(canAcceptReject || canCancel || canCheckout) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canAcceptReject && (
                      <>
                        <button
                          type="button"
                          onClick={() => actOnOffer(offer.id, "ACCEPT")}
                          disabled={loading}
                          className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                        >
                          {labels.accept}
                        </button>
                        <button
                          type="button"
                          onClick={() => actOnOffer(offer.id, "REJECT")}
                          disabled={loading}
                          className="rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 disabled:opacity-60"
                        >
                          {labels.reject}
                        </button>
                      </>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => actOnOffer(offer.id, "CANCEL")}
                        disabled={loading}
                        className="rounded-lg border border-white/20 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 disabled:opacity-60"
                      >
                        {labels.cancel}
                      </button>
                    )}

                    {canCheckout && (
                      <button
                        type="button"
                        onClick={() => checkoutAcceptedOffer(offer)}
                        disabled={loading}
                        className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-60"
                      >
                        {labels.payOffer}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
