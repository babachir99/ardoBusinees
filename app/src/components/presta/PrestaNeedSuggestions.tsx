"use client";

import { useRef, useState } from "react";

type MatchingService = {
  id: string;
  title: string;
  description: string;
  basePriceCents: number;
  currency: string;
  city: string | null;
  provider: {
    id: string;
    name: string | null;
    image: string | null;
  };
  canPropose: boolean;
  alreadyProposed: boolean;
};

type MatchingResponse = {
  services: MatchingService[];
};

type ProviderRating = {
  avgRating: number | null;
  count: number;
};

type Props = {
  locale: string;
  needId: string;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onOpenBooking: (service: { id: string; title: string }) => void;
};

function formatAmount(value: number, currency: string) {
  return `${value} ${currency === "XOF" ? "FCFA" : currency}`;
}

function toErrorMessage(data: unknown, fallback: string) {
  const asRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof asRecord?.message === "string") return asRecord.message;
  if (typeof asRecord?.error === "string") return asRecord.error;
  return fallback;
}

export default function PrestaNeedSuggestions({
  locale,
  needId,
  isLoggedIn,
  onRequireLogin,
  onOpenBooking,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [services, setServices] = useState<MatchingService[]>([]);
  const [providerRatings, setProviderRatings] = useState<Record<string, ProviderRating>>({});
  const loadingProviderIdsRef = useRef<Set<string>>(new Set());

  async function loadProviderRatings(list: MatchingService[]) {
    const providerIds = Array.from(
      new Set(
        list
          .map((service) => service.provider?.id)
          .filter((providerId): providerId is string => Boolean(providerId))
      )
    );

    const idsToFetch = providerIds.filter(
      (providerId) =>
        providerRatings[providerId] === undefined && !loadingProviderIdsRef.current.has(providerId)
    );

    if (idsToFetch.length === 0) return;

    idsToFetch.forEach((providerId) => loadingProviderIdsRef.current.add(providerId));

    const entries = await Promise.all(
      idsToFetch.map(async (providerId) => {
        try {
          const response = await fetch(
            `/api/reviews?targetUserId=${encodeURIComponent(providerId)}&take=1`,
            { method: "GET", cache: "no-store" }
          );

          if (!response.ok) return [providerId, null] as const;

          const data = (await response.json().catch(() => null)) as
            | { meta?: { count?: number; avgRating?: number | null } }
            | null;

          const count = Number(data?.meta?.count ?? 0);
          const avgRatingRaw = data?.meta?.avgRating;
          const avgRating =
            typeof avgRatingRaw === "number" && Number.isFinite(avgRatingRaw) ? avgRatingRaw : null;

          return [providerId, { count, avgRating }] as const;
        } catch {
          return [providerId, null] as const;
        } finally {
          loadingProviderIdsRef.current.delete(providerId);
        }
      })
    );

    const next: Record<string, ProviderRating> = {};
    for (const [providerId, rating] of entries) {
      if (rating) {
        next[providerId] = rating;
      }
    }

    if (Object.keys(next).length > 0) {
      setProviderRatings((current) => ({ ...current, ...next }));
    }
  }

  async function loadSuggestions() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/presta/matching/services?needId=${needId}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as MatchingResponse | null;

      if (!response.ok || !data) {
        setError(toErrorMessage(data, "Unable to load service suggestions"));
        return;
      }

      const nextServices = Array.isArray(data.services) ? data.services : [];
      setServices(nextServices);
      void loadProviderRatings(nextServices);
    } catch {
      setError("Unable to load service suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && services.length === 0) {
      await loadSuggestions();
    }
  }

  async function handleAction(service: MatchingService) {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    if (!service.canPropose) {
      onOpenBooking({ id: service.id, title: service.title });
      return;
    }

    const response = await fetch(`/api/presta/needs/${needId}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: service.id }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const code = typeof data?.error === "string" ? data.error : "";
      if (code === "ALREADY_PROPOSED") {
        setFeedback(locale === "fr" ? "Tu as deja propose." : "Already proposed.");
      } else if (code === "NEED_NOT_OPEN") {
        setFeedback(locale === "fr" ? "Ce besoin n'est plus ouvert." : "This need is no longer open.");
      } else {
        setFeedback(toErrorMessage(data, locale === "fr" ? "Echec de la proposition" : "Proposal failed"));
      }
      return;
    }

    setFeedback(locale === "fr" ? "Proposition envoyee." : "Proposal sent.");
    await loadSuggestions();
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {locale === "fr" ? "Matching prestataires" : "Provider matching"}
        </p>
        <button
          type="button"
          onClick={toggleOpen}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-emerald-300/50 hover:text-white"
        >
          {open
            ? locale === "fr"
              ? "Masquer"
              : "Hide"
            : locale === "fr"
              ? "Voir prestataires"
              : "View providers"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl border border-white/10 bg-zinc-900/60" />
              ))}
            </div>
          ) : null}

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}

          {!loading && !error
            ? services.map((service) => (
                <article
                  key={service.id}
                  className="rounded-xl border border-white/10 bg-zinc-900/70 p-3 text-xs transition hover:border-emerald-300/35"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{service.title}</p>
                      <p className="truncate text-zinc-400">
                        {service.provider.name ?? (locale === "fr" ? "Prestataire" : "Provider")}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-emerald-300">
                      {formatAmount(service.basePriceCents, service.currency)}
                    </p>
                  </div>

                  <p className="mt-2 line-clamp-2 text-zinc-300">{service.description || "-"}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-300">
                      {service.city ?? "-"}
                    </span>
                    {service.provider?.id && providerRatings[service.provider.id]?.count > 0 ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
                        {"\u2605"} {providerRatings[service.provider.id].avgRating?.toFixed(1) ?? "0.0"} ({providerRatings[service.provider.id].count})
                      </span>
                    ) : null}
                    {service.alreadyProposed ? (
                      <span className="rounded-full border border-amber-300/45 bg-amber-300/15 px-2 py-0.5 text-[11px] text-amber-100">
                        {locale === "fr" ? "Deja propose" : "Already proposed"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={service.alreadyProposed}
                      onClick={() => handleAction(service)}
                      className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {service.canPropose
                        ? locale === "fr"
                          ? "Proposer service"
                          : "Propose service"
                        : locale === "fr"
                          ? "Reserver"
                          : "Book"}
                    </button>
                  </div>
                </article>
              ))
            : null}

          {!loading && !error && services.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 bg-zinc-900/40 p-3 text-xs text-zinc-400">
              {locale === "fr" ? "Aucun prestataire correspondant." : "No matching providers."}
            </p>
          ) : null}

          {feedback ? <p className="text-xs text-zinc-300">{feedback}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
