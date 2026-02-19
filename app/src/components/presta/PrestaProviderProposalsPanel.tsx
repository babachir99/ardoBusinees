"use client";

import { useEffect, useState } from "react";

type Proposal = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  createdAt: string;
  message: string | null;
  need: {
    id: string;
    title: string;
    status: string;
    city: string | null;
    area: string | null;
    customer: {
      id: string;
      name: string | null;
      image: string | null;
    };
  };
  service: {
    id: string;
    title: string;
    basePriceCents: number;
    currency: string;
    city: string | null;
  };
  booking: {
    id: string;
    status: string;
    orderId: string | null;
    createdAt: string;
  } | null;
};

type Props = {
  locale: string;
  enabled: boolean;
};

function toErrorMessage(data: unknown, fallback: string) {
  const asRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof asRecord?.message === "string") return asRecord.message;
  if (typeof asRecord?.error === "string") return asRecord.error;
  return fallback;
}

export default function PrestaProviderProposalsPanel({ locale, enabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  async function loadProposals() {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/presta/proposals?mine=1&take=60", {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        setError(toErrorMessage(data, "Unable to load proposals"));
        return;
      }

      setProposals(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load proposals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">
          {locale === "fr" ? "Mes propositions" : "My proposals"}
        </h2>
        <button
          type="button"
          onClick={loadProposals}
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
        >
          {locale === "fr" ? "Rafraichir" : "Refresh"}
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-300">Chargement...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 md:grid-cols-2">
          {proposals.map((proposal) => (
            <article key={proposal.id} className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 text-xs text-zinc-200">
              <p className="font-semibold text-white">{proposal.need.title}</p>
              <p className="mt-1 text-zinc-400">{proposal.service.title}</p>
              <p className="mt-1 text-zinc-400">{proposal.need.customer.name ?? "Client"}</p>
              <p className="mt-2 text-zinc-300">{proposal.status}</p>
              {proposal.booking?.id && (
                <p className="mt-1 text-zinc-400">
                  Booking: {proposal.booking.id} ({proposal.booking.status})
                </p>
              )}
            </article>
          ))}

          {!loading && proposals.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Aucune proposition pour le moment." : "No proposals yet."}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

