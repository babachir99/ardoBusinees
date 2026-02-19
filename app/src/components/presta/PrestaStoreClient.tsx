"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import PrestaNeedSuggestions from "@/components/presta/PrestaNeedSuggestions";
import PrestaNeedProposalsPanel from "@/components/presta/PrestaNeedProposalsPanel";
import PrestaProviderMatchingPanel from "@/components/presta/PrestaProviderMatchingPanel";
import PrestaProviderProposalsPanel from "@/components/presta/PrestaProviderProposalsPanel";

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

type PrestaNeed = {
  id: string;
  customerId: string;
  title: string;
  description: string;
  city: string | null;
  area: string | null;
  budgetCents: number | null;
  currency: string;
  preferredDate: string | null;
  status: "OPEN" | "IN_REVIEW" | "ACCEPTED" | "CLOSED" | "CANCELED";
  createdAt: string;
  customer: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type BookingTarget = {
  id: string;
  title: string;
};

type Props = {
  locale: string;
  isLoggedIn: boolean;
  canPublish: boolean;
  currentUserId?: string | null;
  currentUserRole?: string | null;
};

const paymentMethods = ["WAVE", "ORANGE_MONEY", "CARD", "CASH"] as const;

function formatAmount(value: number | null, currency: string) {
  if (value === null) return "-";
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${value} ${label}`;
}

function shortDescription(value: string | null) {
  if (!value) return "";
  if (value.length <= 110) return value;
  return `${value.slice(0, 107)}...`;
}

function formatDateLabel(value: string | null, locale: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

function toErrorMessage(data: unknown, fallback: string) {
  const asRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof asRecord?.message === "string") return asRecord.message;
  if (typeof asRecord?.error === "string") return asRecord.error;
  return fallback;
}

export default function PrestaStoreClient({
  locale,
  isLoggedIn,
  canPublish,
  currentUserId,
  currentUserRole,
}: Props) {
  const [tab, setTab] = useState<"offers" | "needs" | "provider">("offers");

  const [services, setServices] = useState<PrestaService[]>([]);
  const [needs, setNeeds] = useState<PrestaNeed[]>([]);
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

  const [needTitle, setNeedTitle] = useState("");
  const [needDescription, setNeedDescription] = useState("");
  const [needCity, setNeedCity] = useState("");
  const [needArea, setNeedArea] = useState("");
  const [needBudget, setNeedBudget] = useState("");
  const [needCurrency, setNeedCurrency] = useState("XOF");
  const [needPreferredDate, setNeedPreferredDate] = useState("");
  const [needError, setNeedError] = useState<string | null>(null);
  const [needSuccess, setNeedSuccess] = useState<string | null>(null);
  const [submittingNeed, setSubmittingNeed] = useState(false);
  const [showNeedForm, setShowNeedForm] = useState(false);

  const [bookingService, setBookingService] = useState<BookingTarget | null>(null);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingMethod, setBookingMethod] = useState("WAVE");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const isAdmin = currentUserRole === "ADMIN";

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
        setError(toErrorMessage(data, "Unable to load services"));
        return;
      }

      setServices(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load services");
    } finally {
      setLoading(false);
    }
  }

  async function loadNeeds() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/presta/needs?take=24", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        setError(toErrorMessage(data, "Unable to load needs"));
        return;
      }

      setNeeds(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load needs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "offers") {
      loadServices();
      return;
    }

    if (tab === "needs") {
      loadNeeds();
      return;
    }

    setLoading(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function goToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
  }

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
        setFormError(toErrorMessage(data, "Creation failed"));
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

  async function handleCreateNeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNeedError(null);
    setNeedSuccess(null);

    if (!isLoggedIn) {
      setNeedError(locale === "fr" ? "Connexion requise" : "Login required");
      return;
    }

    const normalizedTitle = needTitle.trim();
    const normalizedDescription = needDescription.trim();

    if (!normalizedTitle || !normalizedDescription) {
      setNeedError(locale === "fr" ? "Titre et description obligatoires" : "Title and description are required");
      return;
    }

    if (normalizedTitle.length > 140 || normalizedDescription.length > 3000) {
      setNeedError(locale === "fr" ? "Texte trop long" : "Text is too long");
      return;
    }

    const parsedBudget = needBudget ? Number(needBudget) : null;
    const parsedBudgetValue = parsedBudget ?? undefined;
    if (parsedBudgetValue !== undefined && (!Number.isFinite(parsedBudgetValue) || parsedBudgetValue < 0)) {
      setNeedError(locale === "fr" ? "Budget invalide" : "Invalid budget");
      return;
    }

    setSubmittingNeed(true);

    try {
      const response = await fetch("/api/presta/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: normalizedTitle,
          description: normalizedDescription,
          city: needCity || undefined,
          area: needArea || undefined,
          budgetCents: parsedBudgetValue !== undefined ? Math.trunc(parsedBudgetValue) : undefined,
          currency: needCurrency,
          preferredDate: needPreferredDate || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNeedError(toErrorMessage(data, "Need publish failed"));
        return;
      }

      setNeedTitle("");
      setNeedDescription("");
      setNeedCity("");
      setNeedArea("");
      setNeedBudget("");
      setNeedCurrency("XOF");
      setNeedPreferredDate("");
      setNeedSuccess(locale === "fr" ? "Besoin publie" : "Need published");
      setShowNeedForm(false);
      await loadNeeds();
    } catch {
      setNeedError("Need publish failed");
    } finally {
      setSubmittingNeed(false);
    }
  }

  function openNeedComposer() {
    if (!isLoggedIn) {
      goToLogin();
      return;
    }

    setNeedError(null);
    setNeedSuccess(null);
    setShowNeedForm((current) => !current);
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
        setBookingError(toErrorMessage(data, "Booking failed"));
        return;
      }

      setBookingService(null);
      setBookingMessage("");
      setBookingMethod("WAVE");
      setFormSuccess(`Booking cree: ${(data as { booking?: { id?: string } })?.booking?.id ?? "OK"}`);
      await loadServices();
    } catch {
      setBookingError("Booking failed");
    } finally {
      setBookingSubmitting(false);
    }
  }

  function openBooking(service: BookingTarget) {
    if (!isLoggedIn) {
      goToLogin();
      return;
    }

    setBookingError(null);
    setBookingService(service);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-3">
        <div className="inline-flex flex-wrap gap-2 rounded-full border border-white/10 bg-zinc-950/70 p-1">
          <button
            type="button"
            onClick={() => setTab("offers")}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              tab === "offers" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
            }`}
          >
            {locale === "fr" ? "Offres" : "Offers"}
          </button>
          <button
            type="button"
            onClick={() => setTab("needs")}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              tab === "needs" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
            }`}
          >
            {locale === "fr" ? "Besoins" : "Needs"}
          </button>
          {canPublish && (
            <button
              type="button"
              onClick={() => setTab("provider")}
              className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                tab === "provider" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
              }`}
            >
              {locale === "fr" ? "Je suis prestataire" : "Provider mode"}
            </button>
          )}
        </div>
      </section>

      {tab === "offers" && canPublish && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <h2 className="text-base font-semibold text-white">Creer un service</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateService}>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Titre
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formTitle} onChange={(event) => setFormTitle(event.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Prix (cents)
              <input type="number" min={1} className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formPrice} onChange={(event) => setFormPrice(event.target.value)} required />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
              Description
              <textarea className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" value={formDescription} onChange={(event) => setFormDescription(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Devise
              <select className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formCurrency} onChange={(event) => setFormCurrency(event.target.value)}>
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Contact (optionnel)
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formContactPhone} onChange={(event) => setFormContactPhone(event.target.value)} />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {paymentMethods.map((method) => (
                <label key={method} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-200">
                  <input type="checkbox" checked={formMethods.includes(method)} onChange={() => togglePaymentMethod(method)} />
                  {method}
                </label>
              ))}
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" disabled={submittingService} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                {submittingService ? "Envoi..." : "Publier"}
              </button>
              {formError && <p className="text-sm text-rose-300">{formError}</p>}
              {formSuccess && <p className="text-sm text-emerald-300">{formSuccess}</p>}
            </div>
          </form>
        </section>
      )}

      {tab === "needs" && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">
              {locale === "fr" ? "Publier un besoin" : "Publish a need"}
            </h2>
            <button
              type="button"
              onClick={openNeedComposer}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
            >
              {locale === "fr" ? "Publier un besoin" : "Publish a need"}
            </button>
          </div>

          {!isLoggedIn && (
            <p className="mt-3 text-xs text-zinc-400">
              {locale === "fr" ? "Connecte-toi pour publier un besoin." : "Sign in to publish a need."}
            </p>
          )}

          {showNeedForm && isLoggedIn && (
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateNeed}>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Titre
                <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needTitle} onChange={(event) => setNeedTitle(event.target.value)} required maxLength={140} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Budget
                <input type="number" min={0} className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needBudget} onChange={(event) => setNeedBudget(event.target.value)} />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
                Description
                <textarea className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" value={needDescription} onChange={(event) => setNeedDescription(event.target.value)} required maxLength={3000} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Ville
                <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needCity} onChange={(event) => setNeedCity(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Zone
                <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needArea} onChange={(event) => setNeedArea(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Devise
                <select className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needCurrency} onChange={(event) => setNeedCurrency(event.target.value)}>
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                {locale === "fr" ? "Date souhaitee" : "Preferred date"}
                <input type="date" className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needPreferredDate} onChange={(event) => setNeedPreferredDate(event.target.value)} />
              </label>
              <div className="md:col-span-2 flex items-center gap-3">
                <button type="submit" disabled={submittingNeed} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                  {submittingNeed ? "Envoi..." : locale === "fr" ? "Publier" : "Publish"}
                </button>
                {needError && <p className="text-sm text-rose-300">{needError}</p>}
                {needSuccess && <p className="text-sm text-emerald-300">{needSuccess}</p>}
              </div>
            </form>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {tab === "offers"
              ? "Services PRESTA"
              : tab === "needs"
                ? locale === "fr"
                  ? "Besoins PRESTA"
                  : "PRESTA needs"
                : locale === "fr"
                  ? "Espace prestataire"
                  : "Provider space"}
          </h2>
          {tab !== "provider" && (
            <button
              type="button"
              onClick={() => (tab === "offers" ? loadServices() : loadNeeds())}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
            >
              Rafraichir
            </button>
          )}
        </div>

        {tab !== "provider" && loading && <p className="text-sm text-zinc-300">Chargement...</p>}
        {tab !== "provider" && error && <p className="text-sm text-rose-300">{error}</p>}

        {tab === "offers" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((service) => (
              <article key={service.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="flex items-start gap-3">
                  {service.provider.image ? (
                    <Image src={service.provider.image} alt={service.provider.name ?? "Provider"} width={42} height={42} className="h-10 w-10 rounded-full object-cover" />
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
                <p className="mt-3 text-sm font-semibold text-emerald-300">{formatAmount(service.basePriceCents, service.currency)}</p>

                {!service.contactLocked && service.contactPhone && (
                  <p className="mt-2 text-xs text-zinc-300">Contact: {service.contactPhone}</p>
                )}

                <button type="button" onClick={() => openBooking({ id: service.id, title: service.title })} className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
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
        ) : tab === "needs" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {needs.map((need) => (
              <article key={need.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                <h3 className="text-base font-semibold text-white">{need.title}</h3>
                <p className="mt-1 text-xs text-zinc-400">{need.customer?.name ?? "Client"}</p>
                <p className="mt-3 text-sm text-zinc-300">{shortDescription(need.description) || "-"}</p>
                <div className="mt-3 grid gap-1 text-xs text-zinc-400">
                  <p>{locale === "fr" ? "Statut" : "Status"}: {need.status}</p>
                  <p>{locale === "fr" ? "Ville" : "City"}: {need.city ?? "-"}</p>
                  <p>{locale === "fr" ? "Zone" : "Area"}: {need.area ?? "-"}</p>
                  <p>{locale === "fr" ? "Budget" : "Budget"}: {formatAmount(need.budgetCents, need.currency)}</p>
                  <p>{locale === "fr" ? "Date souhaitee" : "Preferred date"}: {formatDateLabel(need.preferredDate, locale)}</p>
                  <p>{locale === "fr" ? "Publie le" : "Published"}: {formatDateLabel(need.createdAt, locale)}</p>
                </div>

                <PrestaNeedSuggestions
                  locale={locale}
                  needId={need.id}
                  isLoggedIn={isLoggedIn}
                  onRequireLogin={goToLogin}
                  onOpenBooking={openBooking}
                />

                <PrestaNeedProposalsPanel
                  locale={locale}
                  needId={need.id}
                  needStatus={need.status}
                  isLoggedIn={isLoggedIn}
                  isOwner={Boolean(currentUserId && currentUserId === need.customerId) || isAdmin}
                  onRequireLogin={goToLogin}
                  onAccepted={loadNeeds}
                />
              </article>
            ))}

            {!loading && needs.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
                {locale === "fr" ? "Aucun besoin ouvert." : "No open needs."}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <PrestaProviderMatchingPanel locale={locale} isLoggedIn={isLoggedIn} enabled={canPublish} onRequireLogin={goToLogin} />
            <PrestaProviderProposalsPanel locale={locale} enabled={canPublish} />
          </div>
        )}
      </section>

      {bookingService && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Reserver: {bookingService.title}</h3>
              <button type="button" className="rounded-full border border-white/20 px-2 py-1 text-xs text-zinc-200" onClick={() => setBookingService(null)}>
                Fermer
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleBookingSubmit}>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Message
                <textarea className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" value={bookingMessage} onChange={(event) => setBookingMessage(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Methode de paiement
                <select className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={bookingMethod} onChange={(event) => setBookingMethod(event.target.value)}>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              {bookingError && <p className="text-sm text-rose-300">{bookingError}</p>}

              <button type="submit" disabled={bookingSubmitting} className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                {bookingSubmitting ? "Envoi..." : "Confirmer la reservation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

