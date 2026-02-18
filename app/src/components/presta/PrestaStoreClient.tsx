"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";

type PrestaService = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  city: string | null;
  basePriceCents: number;
  currency: string;
  acceptedPaymentMethods: string[];
  provider: {
    id: string;
    name: string | null;
    image: string | null;
  };
  contactLocked: boolean;
  contactUnlockStatusHint: string | null;
  contactPhone?: string | null;
};

type Props = {
  locale: string;
  isLoggedIn: boolean;
  canPublish: boolean;
};

const paymentMethods = ["WAVE", "ORANGE_MONEY", "CARD", "CASH"] as const;

function formatAmount(value: number, currency: string) {
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${value} ${label}`;
}

function shortDescription(value: string | null) {
  if (!value) return "";
  if (value.length <= 110) return value;
  return `${value.slice(0, 107)}...`;
}

export default function PrestaStoreClient({ locale, isLoggedIn, canPublish }: Props) {
  const [services, setServices] = useState<PrestaService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCurrency, setFormCurrency] = useState("XOF");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formMethods, setFormMethods] = useState<string[]>(["CASH"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submittingService, setSubmittingService] = useState(false);

  const [bookingService, setBookingService] = useState<PrestaService | null>(null);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingMethod, setBookingMethod] = useState("WAVE");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  async function loadServices() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/presta/services", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to load services");
        return;
      }

      setServices(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePaymentMethod(method: string) {
    setFormMethods((current) => {
      if (current.includes(method)) {
        const next = current.filter((entry) => entry !== method);
        return next.length > 0 ? next : ["CASH"];
      }
      return [...current, method];
    });
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!canPublish) {
      setFormError("Forbidden");
      return;
    }

    const parsedPrice = Number(formPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFormError("Prix invalide");
      return;
    }

    setSubmittingService(true);
    try {
      const response = await fetch("/api/presta/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          basePriceCents: Math.trunc(parsedPrice),
          currency: formCurrency,
          acceptedPaymentMethods: formMethods,
          contactPhone: formContactPhone || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(typeof data?.error === "string" ? data.error : "Creation failed");
        return;
      }

      setFormTitle("");
      setFormDescription("");
      setFormPrice("");
      setFormCurrency("XOF");
      setFormContactPhone("");
      setFormMethods(["CASH"]);
      setFormSuccess("Service cree");
      await loadServices();
    } catch {
      setFormError("Creation failed");
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingService) return;

    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const response = await fetch(`/api/presta/services/${bookingService.id}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: bookingMessage,
          paymentMethod: bookingMethod,
          provider: "provider_pending",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBookingError(typeof data?.error === "string" ? data.error : "Booking failed");
        return;
      }

      setBookingService(null);
      setBookingMessage("");
      setBookingMethod("WAVE");
      setFormSuccess(`Booking cree: ${data?.booking?.id ?? "OK"}`);
      await loadServices();
    } catch {
      setBookingError("Booking failed");
    } finally {
      setBookingSubmitting(false);
    }
  }

  function openBooking(service: PrestaService) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
      return;
    }

    setBookingError(null);
    setBookingService(service);
  }

  return (
    <div className="space-y-8">
      {canPublish && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <h2 className="text-base font-semibold text-white">Creer un service</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateService}>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Titre
              <input
                className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Prix (cents)
              <input
                type="number"
                min={1}
                className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                value={formPrice}
                onChange={(event) => setFormPrice(event.target.value)}
                required
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
              Description
              <textarea
                className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Devise
              <select
                className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                value={formCurrency}
                onChange={(event) => setFormCurrency(event.target.value)}
              >
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Contact (optionnel)
              <input
                className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                value={formContactPhone}
                onChange={(event) => setFormContactPhone(event.target.value)}
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {paymentMethods.map((method) => (
                <label key={method} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-200">
                  <input
                    type="checkbox"
                    checked={formMethods.includes(method)}
                    onChange={() => togglePaymentMethod(method)}
                  />
                  {method}
                </label>
              ))}
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submittingService}
                className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
              >
                {submittingService ? "Envoi..." : "Publier"}
              </button>
              {formError && <p className="text-sm text-rose-300">{formError}</p>}
              {formSuccess && <p className="text-sm text-emerald-300">{formSuccess}</p>}
            </div>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Services PRESTA</h2>
          <button
            type="button"
            onClick={loadServices}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
          >
            Rafraichir
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-300">Chargement...</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {services.map((service) => (
            <article key={service.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
              <div className="flex items-start gap-3">
                {service.provider.image ? (
                  <Image
                    src={service.provider.image}
                    alt={service.provider.name ?? "Provider"}
                    width={42}
                    height={42}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-white">
                    {(service.provider.name ?? "P").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">{service.title}</h3>
                  <p className="text-xs text-zinc-400">{service.provider.name ?? "Provider"}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-zinc-300">{shortDescription(service.description) || "-"}</p>
              <p className="mt-3 text-sm font-semibold text-emerald-300">
                {formatAmount(service.basePriceCents, service.currency)}
              </p>

              {!service.contactLocked && service.contactPhone && (
                <p className="mt-2 text-xs text-zinc-300">Contact: {service.contactPhone}</p>
              )}

              <button
                type="button"
                onClick={() => openBooking(service)}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Reserver
              </button>
            </article>
          ))}

          {!loading && services.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              Aucun service pour le moment.
            </div>
          )}
        </div>
      </section>

      {bookingService && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Reserver: {bookingService.title}</h3>
              <button
                type="button"
                className="rounded-full border border-white/20 px-2 py-1 text-xs text-zinc-200"
                onClick={() => setBookingService(null)}
              >
                Fermer
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleBookingSubmit}>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Message
                <textarea
                  className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                  value={bookingMessage}
                  onChange={(event) => setBookingMessage(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Methode de paiement
                <select
                  className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                  value={bookingMethod}
                  onChange={(event) => setBookingMethod(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              {bookingError && <p className="text-sm text-rose-300">{bookingError}</p>}

              <button
                type="submit"
                disabled={bookingSubmitting}
                className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
              >
                {bookingSubmitting ? "Envoi..." : "Confirmer la reservation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
