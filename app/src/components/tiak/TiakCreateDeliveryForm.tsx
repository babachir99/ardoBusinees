"use client";

import { type FormEvent, useState } from "react";
import { type TiakDelivery } from "@/components/tiak/types";

type Props = {
  locale: string;
  isLoggedIn: boolean;
  onCreated: (delivery: TiakDelivery) => void;
};

const paymentMethods = ["CASH", "WAVE", "ORANGE_MONEY", "CARD"];

type CreationResponse = TiakDelivery & {
  error?: string;
  delivery?: TiakDelivery;
  paymentInitialization?: {
    intentId?: string;
    payments?: Array<{ providerRef?: string | null }>;
  } | null;
};

export default function TiakCreateDeliveryForm({ locale, isLoggedIn, onCreated }: Props) {
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [note, setNote] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function redirectToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoggedIn) {
      redirectToLogin();
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setPaymentInfo(null);

    const parsedPrice = priceCents.trim() ? Number(priceCents) : null;
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setError(locale === "fr" ? "Prix invalide" : "Invalid price");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/tiak-tiak/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress,
          dropoffAddress,
          note: note || undefined,
          priceCents: parsedPrice === null ? undefined : Math.trunc(parsedPrice),
          currency,
          paymentMethod,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as CreationResponse;
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : locale === "fr" ? "Creation impossible" : "Creation failed");
        return;
      }

      const createdDelivery = data.delivery ?? (data as unknown as TiakDelivery);
      onCreated(createdDelivery);
      setPickupAddress("");
      setDropoffAddress("");
      setNote("");
      setPriceCents("");
      setCurrency("XOF");
      setPaymentMethod("CASH");
      setSuccess(locale === "fr" ? "Demande creee" : "Request created");

      const providerRef = data.paymentInitialization?.payments?.[0]?.providerRef;
      const intentId = data.paymentInitialization?.intentId;

      if (providerRef || intentId) {
        setPaymentInfo(
          locale === "fr"
            ? `Paiement initialise (${providerRef ?? intentId})`
            : `Payment initialized (${providerRef ?? intentId})`
        );
      }
    } catch {
      setError(locale === "fr" ? "Creation impossible" : "Creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <h2 className="text-lg font-semibold text-white">
          {locale === "fr" ? "Creer une demande" : "Create a request"}
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          {locale === "fr"
            ? "Connecte-toi pour publier une demande de livraison Tiak Tiak."
            : "Sign in to publish a Tiak Tiak delivery request."}
        </p>
        <button
          type="button"
          onClick={redirectToLogin}
          className="mt-4 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-105"
        >
          {locale === "fr" ? "Creer une demande" : "Create a request"}
        </button>
      </section>
    );
  }

  const canSubmit = pickupAddress.trim().length > 0 && dropoffAddress.trim().length > 0 && !submitting;

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{locale === "fr" ? "Nouvelle mission" : "New mission"}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {locale === "fr" ? "Creer une demande" : "Create request"}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {locale === "fr" ? "Formulaire rapide pour lancer une livraison locale." : "Fast form to launch a local delivery."}
          </p>
        </div>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-white">{locale === "fr" ? "Trajet" : "Route"}</h3>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Adresse de ramassage" : "Pickup address"}
              <input
                className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
                value={pickupAddress}
                onChange={(event) => setPickupAddress(event.target.value)}
                placeholder={locale === "fr" ? "Ex: Almadies, Dakar" : "Ex: Almadies, Dakar"}
                required
              />
              <span className="text-[11px] text-zinc-500">{locale === "fr" ? "Point de collecte" : "Pickup location"}</span>
            </label>

            <label className="grid gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Adresse de livraison" : "Dropoff address"}
              <input
                className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
                value={dropoffAddress}
                onChange={(event) => setDropoffAddress(event.target.value)}
                placeholder={locale === "fr" ? "Ex: Plateau, Dakar" : "Ex: Plateau, Dakar"}
                required
              />
              <span className="text-[11px] text-zinc-500">{locale === "fr" ? "Destination finale" : "Final destination"}</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-white">{locale === "fr" ? "Paiement" : "Payment"}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Prix (optionnel)" : "Price (optional)"}
              <input
                type="number"
                min={1}
                className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
                value={priceCents}
                onChange={(event) => setPriceCents(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Devise" : "Currency"}
              <select
                className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Paiement" : "Payment"}
              <select
                className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-white">{locale === "fr" ? "Note" : "Note"}</h3>
          <label className="mt-3 grid gap-1 text-xs text-zinc-300">
            {locale === "fr" ? "Informations complementaires (optionnelles)" : "Additional details (optional)"}
            <textarea
              className="min-h-20 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1200}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? locale === "fr"
                ? "Envoi..."
                : "Submitting..."
              : locale === "fr"
                ? "Creer la demande"
                : "Create request"}
          </button>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          {success && <p className="text-sm text-emerald-300">{success}</p>}
        </div>

        {paymentInfo && <p className="text-xs text-emerald-300">{paymentInfo}</p>}
      </form>
    </section>
  );
}
