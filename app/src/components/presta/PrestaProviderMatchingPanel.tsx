"use client";

import { useEffect, useState } from "react";

type ProviderNeed = {
  need: {
    id: string;
    title: string;
    description: string;
    city: string | null;
    area: string | null;
    budgetCents: number | null;
    currency: string;
    preferredDate: string | null;
    createdAt: string;
    status: string;
  };
  customer: {
    id: string;
    name: string | null;
    image: string | null;
  };
  alreadyProposed: boolean;
};

type ProviderService = {
  id: string;
  title: string;
};

type Props = {
  locale: string;
  isLoggedIn: boolean;
  enabled: boolean;
  onRequireLogin: () => void;
};

function formatAmount(value: number | null, currency: string) {
  if (value === null) return "-";
  return `${value} ${currency === "XOF" ? "FCFA" : currency}`;
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

export default function PrestaProviderMatchingPanel({ locale, isLoggedIn, enabled, onRequireLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needs, setNeeds] = useState<ProviderNeed[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [serviceByNeed, setServiceByNeed] = useState<Record<string, string>>({});
  const [messageByNeed, setMessageByNeed] = useState<Record<string, string>>({});
  const [feedbackByNeed, setFeedbackByNeed] = useState<Record<string, string>>({});
  const [submittingNeedId, setSubmittingNeedId] = useState<string | null>(null);

  async function loadData() {
    if (!enabled) return;

    if (!isLoggedIn) {
      setNeeds([]);
      setServices([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [needsResponse, servicesResponse] = await Promise.all([
        fetch("/api/presta/matching/needs?take=24", { method: "GET", cache: "no-store" }),
        fetch("/api/presta/services?mine=1&take=50", { method: "GET", cache: "no-store" }),
      ]);

      const needsData = await needsResponse.json().catch(() => []);
      const servicesData = await servicesResponse.json().catch(() => []);

      if (!needsResponse.ok) {
        setError(toErrorMessage(needsData, "Unable to load matching needs"));
        return;
      }

      if (!servicesResponse.ok) {
        setError(toErrorMessage(servicesData, "Unable to load your services"));
        return;
      }

      setNeeds(Array.isArray(needsData) ? needsData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } catch {
      setError("Unable to load provider matching");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isLoggedIn]);

  async function handlePropose(needId: string) {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    const serviceId = serviceByNeed[needId] || services[0]?.id;
    if (!serviceId) {
      setFeedbackByNeed((current) => ({
        ...current,
        [needId]: locale === "fr" ? "Choisis un service." : "Select a service first.",
      }));
      return;
    }

    setSubmittingNeedId(needId);

    try {
      const response = await fetch(`/api/presta/needs/${needId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, message: messageByNeed[needId] || undefined }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = typeof data?.error === "string" ? data.error : "";
        if (code === "ALREADY_PROPOSED") {
          setFeedbackByNeed((current) => ({
            ...current,
            [needId]: locale === "fr" ? "Tu as deja propose." : "Already proposed.",
          }));
        } else if (code === "NEED_NOT_OPEN") {
          setFeedbackByNeed((current) => ({
            ...current,
            [needId]: locale === "fr" ? "Ce besoin n'est plus ouvert." : "This need is no longer open.",
          }));
        } else {
          setFeedbackByNeed((current) => ({
            ...current,
            [needId]: toErrorMessage(data, locale === "fr" ? "Echec de la proposition" : "Proposal failed"),
          }));
        }
        return;
      }

      setFeedbackByNeed((current) => ({
        ...current,
        [needId]: locale === "fr" ? "Proposition envoyee." : "Proposal sent.",
      }));
      await loadData();
    } finally {
      setSubmittingNeedId(null);
    }
  }

  if (!enabled) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">
          {locale === "fr" ? "Trouver des besoins" : "Find needs"}
        </h2>
        <button
          type="button"
          onClick={loadData}
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
        >
          {locale === "fr" ? "Rafraichir" : "Refresh"}
        </button>
      </div>

      {!isLoggedIn && (
        <button type="button" onClick={onRequireLogin} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950">
          {locale === "fr" ? "Se connecter" : "Sign in"}
        </button>
      )}

      {loading && <p className="text-sm text-zinc-300">Chargement...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 md:grid-cols-2">
          {needs.map((entry) => {
            const selectedService = serviceByNeed[entry.need.id] || services[0]?.id || "";
            const isSubmitting = submittingNeedId === entry.need.id;

            return (
              <article key={entry.need.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <h3 className="text-base font-semibold text-white">{entry.need.title}</h3>
                <p className="mt-1 text-xs text-zinc-400">{entry.customer.name ?? "Client"}</p>
                <p className="mt-2 text-sm text-zinc-300">{entry.need.description}</p>
                <div className="mt-3 grid gap-1 text-xs text-zinc-400">
                  <p>{locale === "fr" ? "Ville" : "City"}: {entry.need.city ?? "-"}</p>
                  <p>{locale === "fr" ? "Zone" : "Area"}: {entry.need.area ?? "-"}</p>
                  <p>{locale === "fr" ? "Budget" : "Budget"}: {formatAmount(entry.need.budgetCents, entry.need.currency)}</p>
                  <p>{locale === "fr" ? "Publie le" : "Published"}: {formatDateLabel(entry.need.createdAt, locale)}</p>
                </div>

                {entry.alreadyProposed ? (
                  <p className="mt-3 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                    {locale === "fr" ? "Deja propose" : "Already proposed"}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      {locale === "fr" ? "Choisir un service" : "Select service"}
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
                        value={selectedService}
                        onChange={(event) =>
                          setServiceByNeed((current) => ({ ...current, [entry.need.id]: event.target.value }))
                        }
                      >
                        {services.length === 0 ? (
                          <option value="">{locale === "fr" ? "Aucun service" : "No services"}</option>
                        ) : (
                          services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.title}
                            </option>
                          ))
                        )}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      {locale === "fr" ? "Message (optionnel)" : "Message (optional)"}
                      <textarea
                        className="min-h-16 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                        value={messageByNeed[entry.need.id] ?? ""}
                        onChange={(event) =>
                          setMessageByNeed((current) => ({ ...current, [entry.need.id]: event.target.value }))
                        }
                      />
                    </label>

                    <button
                      type="button"
                      disabled={isSubmitting || services.length === 0}
                      onClick={() => handlePropose(entry.need.id)}
                      className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
                    >
                      {isSubmitting
                        ? locale === "fr"
                          ? "Envoi..."
                          : "Sending..."
                        : locale === "fr"
                          ? "Proposer avec ce service"
                          : "Propose with this service"}
                    </button>
                  </div>
                )}

                {feedbackByNeed[entry.need.id] && (
                  <p className="mt-3 text-sm text-zinc-200">{feedbackByNeed[entry.need.id]}</p>
                )}
              </article>
            );
          })}

          {!loading && needs.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Aucun besoin compatible pour le moment." : "No matching open needs for now."}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
