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
      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
        <h2 className="text-base font-semibold text-white">
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
          className="mt-4 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          {locale === "fr" ? "Creer une demande" : "Create a request"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-base font-semibold text-white">
        {locale === "fr" ? "Nouvelle demande" : "New request"}
      </h2>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-zinc-300 md:col-span-2">
          {locale === "fr" ? "Adresse de ramassage" : "Pickup address"}
          <input
            className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
            value={pickupAddress}
            onChange={(event) => setPickupAddress(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-300 md:col-span-2">
          {locale === "fr" ? "Adresse de livraison" : "Dropoff address"}
          <input
            className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
            value={dropoffAddress}
            onChange={(event) => setDropoffAddress(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          {locale === "fr" ? "Prix (optionnel)" : "Price (optional)"}
          <input
            type="number"
            min={1}
            className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
            value={priceCents}
            onChange={(event) => setPriceCents(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          {locale === "fr" ? "Devise" : "Currency"}
          <select
            className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="XOF">XOF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          {locale === "fr" ? "Paiement" : "Payment"}
          <select
            className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
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

        <label className="flex flex-col gap-1 text-xs text-zinc-300 md:col-span-2">
          {locale === "fr" ? "Note (optionnelle)" : "Optional note"}
          <textarea
            className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1200}
          />
        </label>

        <div className="md:col-span-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
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
        </div>
      </form>
    </section>
  );
}
