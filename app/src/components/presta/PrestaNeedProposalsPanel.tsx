"use client";

import { useState } from "react";

type Proposal = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  createdAt: string;
  message: string | null;
  provider: {
    id: string;
    name: string | null;
    image: string | null;
  };
  service: {
    id: string;
    title: string;
    basePriceCents: number;
    currency: string;
    city: string | null;
  };
  bookingId?: string | null;
};

type AcceptResponse = {
  booking?: {
    id: string;
    status: string;
    orderId: string | null;
  } | null;
  paymentInitialization?: {
    intentId?: string;
    provider?: string;
  } | null;
};

type Props = {
  locale: string;
  needId: string;
  needStatus: string;
  isLoggedIn: boolean;
  isOwner: boolean;
  onRequireLogin: () => void;
  onAccepted?: () => Promise<void> | void;
};

const paymentMethods = ["CASH", "WAVE", "ORANGE_MONEY", "CARD"] as const;

function toErrorMessage(data: unknown, fallback: string) {
  const asRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof asRecord?.message === "string") return asRecord.message;
  if (typeof asRecord?.error === "string") return asRecord.error;
  return fallback;
}

function formatAmount(value: number, currency: string) {
  return `${value} ${currency === "XOF" ? "FCFA" : currency}`;
}

export default function PrestaNeedProposalsPanel({
  locale,
  needId,
  needStatus,
  isLoggedIn,
  isOwner,
  onRequireLogin,
  onAccepted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [paymentMethodByProposal, setPaymentMethodByProposal] = useState<Record<string, string>>({});

  async function loadProposals() {
    if (!isLoggedIn) {
      setError(locale === "fr" ? "Connexion requise" : "Authentication required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/presta/needs/${needId}/proposals`, {
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

  async function toggleOpen() {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    const next = !open;
    setOpen(next);
    if (next) {
      await loadProposals();
    }
  }

  async function handleAccept(proposalId: string) {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setAcceptingId(proposalId);
    setFeedback(null);

    const paymentMethod = paymentMethodByProposal[proposalId] || "CASH";

    try {
      const response = await fetch(`/api/presta/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ACCEPTED",
          paymentMethod,
          provider: "provider_pending",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as AcceptResponse & {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setFeedback(toErrorMessage(data, locale === "fr" ? "Echec de l'acceptation" : "Accept failed"));
        return;
      }

      const bookingPart = data.booking?.id
        ? `${locale === "fr" ? "Booking" : "Booking"}: ${data.booking.id} (${data.booking.status})`
        : locale === "fr"
          ? "Booking cree"
          : "Booking created";

      const paymentPart = data.paymentInitialization
        ? locale === "fr"
          ? "Paiement initialise"
          : "Payment initialized"
        : "";

      setFeedback([bookingPart, paymentPart].filter(Boolean).join(" • "));
      await loadProposals();
      await onAccepted?.();
    } catch {
      setFeedback(locale === "fr" ? "Echec de l'acceptation" : "Accept failed");
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggleOpen}
        className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white"
      >
        {open
          ? locale === "fr"
            ? "Masquer les propositions"
            : "Hide proposals"
          : locale === "fr"
            ? "Voir propositions"
            : "View proposals"}
      </button>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-zinc-950/50 p-3">
          {loading && <p className="text-xs text-zinc-300">Chargement...</p>}
          {error && <p className="text-xs text-rose-300">{error}</p>}

          {!loading && !error && proposals.map((proposal) => {
            const method = paymentMethodByProposal[proposal.id] || "CASH";
            const canAccept = isOwner && needStatus === "OPEN" && proposal.status === "PENDING";

            return (
              <div key={proposal.id} className="rounded-lg border border-white/10 bg-zinc-900/70 p-3 text-xs text-zinc-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{proposal.service.title}</p>
                    <p className="text-zinc-400">{proposal.provider.name ?? "Provider"}</p>
                  </div>
                  <p className="font-semibold text-emerald-300">{formatAmount(proposal.service.basePriceCents, proposal.service.currency)}</p>
                </div>

                <p className="mt-1 text-zinc-400">{proposal.status}</p>
                {proposal.message && <p className="mt-1 text-zinc-300">{proposal.message}</p>}

                {canAccept && (
                  <div className="mt-3 space-y-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      {locale === "fr" ? "Paiement" : "Payment"}
                      <select
                        className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        value={method}
                        onChange={(event) =>
                          setPaymentMethodByProposal((current) => ({
                            ...current,
                            [proposal.id]: event.target.value,
                          }))
                        }
                      >
                        {paymentMethods.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={acceptingId === proposal.id}
                      onClick={() => handleAccept(proposal.id)}
                      className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                    >
                      {acceptingId === proposal.id
                        ? locale === "fr"
                          ? "Envoi..."
                          : "Sending..."
                        : locale === "fr"
                          ? "Accepter"
                          : "Accept"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && !error && proposals.length === 0 && (
            <p className="text-xs text-zinc-400">
              {locale === "fr" ? "Aucune proposition pour ce besoin." : "No proposals for this need."}
            </p>
          )}

          {feedback && <p className="text-xs text-zinc-300">{feedback}</p>}
        </div>
      )}
    </div>
  );
}

