"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { type TiakDelivery } from "@/components/tiak/types";

type Props = {
  locale: string;
  isLoggedIn: boolean;
  onCreated: (delivery: TiakDelivery) => void;
};

type SectionKey = "route" | "payment" | "note";

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
  const [openSection, setOpenSection] = useState<SectionKey>("route");

  const pickupTrimmed = pickupAddress.trim();
  const dropoffTrimmed = dropoffAddress.trim();
  const priceTrimmed = priceCents.trim();
  const routeIsValid = pickupTrimmed.length > 0 && dropoffTrimmed.length > 0;

  const isRouteOpen = openSection === "route";
  const isPaymentOpen = openSection === "payment";
  const isNoteOpen = openSection === "note";

  useEffect(() => {
    if (routeIsValid && openSection === "route") {
      setOpenSection("payment");
    }
  }, [openSection, routeIsValid]);

  const progressTotalCount = 5;
  const progressFilledCount =
    (pickupTrimmed ? 1 : 0) +
    (dropoffTrimmed ? 1 : 0) +
    (priceTrimmed ? 1 : 0) +
    (currency.trim() ? 1 : 0) +
    (paymentMethod.trim() ? 1 : 0);

  const progressPercent = useMemo(
    () => Math.round((progressFilledCount / progressTotalCount) * 100),
    [progressFilledCount]
  );

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

    const parsedPrice = priceTrimmed ? Number(priceTrimmed) : null;
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
        setError(
          typeof data?.error === "string"
            ? data.error
            : locale === "fr"
              ? "Creation impossible"
              : "Creation failed"
        );
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
      setOpenSection("route");
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

  const canSubmit = routeIsValid && !submitting;

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {locale === "fr" ? "Nouvelle mission" : "New mission"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {locale === "fr" ? "Creer une demande" : "Create request"}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {locale === "fr"
              ? "Formulaire rapide pour lancer une livraison locale."
              : "Fast form to launch a local delivery."}
          </p>
        </div>
      </div>

      <div className="group mt-4 rounded-xl border border-white/10 bg-zinc-950/40 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.25)] motion-reduce:transform-none motion-reduce:transition-none">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {locale === "fr" ? "Resume" : "Summary"}
          </p>
          <p className="text-xs text-zinc-500">{progressFilledCount} / {progressTotalCount} {locale === "fr" ? "completes" : "completed"}</p>
        </div>

        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="h-full rounded-full bg-emerald-300 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-3">
          <span className="text-[11px] text-zinc-500">{locale === "fr" ? "Trajet" : "Route"}</span>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-xs">
            <span className="max-w-[40%] truncate rounded-full border border-white/15 bg-zinc-950/70 px-2.5 py-1 text-zinc-100">
              {pickupTrimmed || (locale === "fr" ? "Ramassage" : "Pickup")}
            </span>
            <span className="relative inline-flex items-center">
              <span className="h-[2px] w-8 rounded-full bg-zinc-600 transition-colors duration-200 group-hover:bg-emerald-300/30 motion-reduce:transition-none" />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="ml-1 h-3.5 w-3.5 text-zinc-300 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                aria-hidden="true"
              >
                <path d="M5 12h13" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </span>
            <span className="max-w-[40%] truncate rounded-full border border-white/15 bg-zinc-950/70 px-2.5 py-1 text-zinc-100">
              {dropoffTrimmed || (locale === "fr" ? "Livraison" : "Dropoff")}
            </span>
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs">
            <span className="text-zinc-500">{locale === "fr" ? "Prix" : "Price"}</span>
            <p className="mt-1 text-zinc-100">
              {priceTrimmed ? `${priceTrimmed} ${currency}` : locale === "fr" ? "Prix non defini" : "No price set"}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs">
            <span className="text-zinc-500">{locale === "fr" ? "Paiement" : "Payment"}</span>
            <p className="mt-1 text-zinc-100">{paymentMethod}</p>
          </div>
        </div>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.22)] motion-reduce:transform-none motion-reduce:transition-none">
          <button
            type="button"
            onClick={() => setOpenSection("route")}
            aria-expanded={isRouteOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-semibold text-white">{locale === "fr" ? "Trajet" : "Route"}</span>
            <span className="inline-flex items-center gap-2">
              {routeIsValid ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-300/15 text-emerald-200">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                </span>
              ) : null}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`h-4 w-4 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${isRouteOpen ? "rotate-180" : "rotate-0"}`}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>

          <div className={`grid overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none ${isRouteOpen ? "mt-3 max-h-[360px] translate-y-0 opacity-100" : "max-h-0 -translate-y-2 opacity-0"}`}>
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs text-zinc-300">
                {locale === "fr" ? "Adresse de ramassage" : "Pickup address"}
                <input
                  className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/30"
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
                  className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/30"
                  value={dropoffAddress}
                  onChange={(event) => setDropoffAddress(event.target.value)}
                  placeholder={locale === "fr" ? "Ex: Plateau, Dakar" : "Ex: Plateau, Dakar"}
                  required
                />
                <span className="text-[11px] text-zinc-500">{locale === "fr" ? "Destination finale" : "Final destination"}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.22)] motion-reduce:transform-none motion-reduce:transition-none">
          <button
            type="button"
            onClick={() => setOpenSection("payment")}
            aria-expanded={isPaymentOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-semibold text-white">{locale === "fr" ? "Paiement" : "Payment"}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${isPaymentOpen ? "rotate-180" : "rotate-0"}`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div className={`grid overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none ${isPaymentOpen ? "mt-3 max-h-[280px] translate-y-0 opacity-100" : "max-h-0 -translate-y-2 opacity-0"}`}>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-xs text-zinc-300">
                {locale === "fr" ? "Prix (optionnel)" : "Price (optional)"}
                <input
                  type="number"
                  min={1}
                  className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/30"
                  value={priceCents}
                  onChange={(event) => setPriceCents(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-xs text-zinc-300">
                {locale === "fr" ? "Devise" : "Currency"}
                <select
                  className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/30"
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
                  className="h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/30"
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
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.22)] motion-reduce:transform-none motion-reduce:transition-none">
          <button
            type="button"
            onClick={() => setOpenSection("note")}
            aria-expanded={isNoteOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-semibold text-white">{locale === "fr" ? "Note" : "Note"}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${isNoteOpen ? "rotate-180" : "rotate-0"}`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div className={`grid overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none ${isNoteOpen ? "mt-3 max-h-[240px] translate-y-0 opacity-100" : "max-h-0 -translate-y-2 opacity-0"}`}>
            <label className="grid gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Informations complementaires (optionnelles)" : "Additional details (optional)"}
              <textarea
                className="min-h-20 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/30"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1200}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
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

          {!canSubmit ? (
            <p className="text-xs text-zinc-500">
              {locale === "fr" ? "Renseigne le trajet pour continuer" : "Fill route details to continue"}
            </p>
          ) : null}
        </div>

        {paymentInfo && <p className="text-xs text-emerald-300">{paymentInfo}</p>}
      </form>
    </section>
  );
}

