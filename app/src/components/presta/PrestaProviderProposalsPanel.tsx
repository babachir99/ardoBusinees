"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Proposal = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  createdAt: string;
  service?: {
    id: string;
    title: string;
  };
  need?: {
    id: string;
    title: string;
  };
};

type Payout = {
  id: string;
  status: "PENDING" | "READY" | "PAID" | "FAILED";
  amountTotalCents: number;
  platformFeeCents: number;
  providerPayoutCents: number;
  currency: string;
  createdAt: string;
  bookingId: string;
};

type Props = {
  onClose: () => void;
  initialView?: "proposals" | "payouts";
};

function toErrorMessage(data: unknown, fallback: string) {
  const asRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof asRecord?.message === "string") return asRecord.message;
  if (typeof asRecord?.error === "string") return asRecord.error;
  return fallback;
}

function formatDateLabel(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

function formatAmount(value: number, currency: string) {
  if (!Number.isFinite(value)) return "-";
  if (currency === "XOF") return `${value} FCFA`;
  return `${value} ${currency}`;
}

export default function PrestaProviderProposalsPanel({ onClose, initialView = "proposals" }: Props) {
  const pathname = usePathname();
  const locale = useMemo(() => (pathname?.startsWith("/fr") ? "fr" : "en"), [pathname]);

  const [view, setView] = useState<"proposals" | "payouts">(initialView);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    let cancelled = false;

    async function loadProposals() {
      setLoading(true);
      setErrorMsg(null);
      setRequiresLogin(false);

      try {
        const response = await fetch("/api/presta/proposals?mine=1", {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 401) {
            setErrorMsg(locale === "fr" ? "Connecte-toi pour voir tes propositions." : "Sign in to view your proposals.");
            setRequiresLogin(true);
            return;
          }

          if (response.status === 403) {
            setErrorMsg(locale === "fr" ? "Acces reserve prestataires." : "Access restricted to providers.");
            return;
          }

          if (response.status === 503) {
            setErrorMsg(locale === "fr" ? "Service indisponible." : "Service unavailable.");
            return;
          }

          setErrorMsg(toErrorMessage(data, locale === "fr" ? "Erreur serveur." : "Server error."));
          return;
        }

        setProposals(Array.isArray(data) ? (data as Proposal[]) : []);
      } catch {
        if (!cancelled) {
          setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadPayouts() {
      setLoading(true);
      setErrorMsg(null);
      setRequiresLogin(false);

      try {
        const response = await fetch("/api/presta/payouts?mine=1", {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 401) {
            setErrorMsg(locale === "fr" ? "Connecte-toi pour voir tes payouts." : "Sign in to view your payouts.");
            setRequiresLogin(true);
            return;
          }

          if (response.status === 403) {
            setErrorMsg(locale === "fr" ? "Acces reserve prestataires." : "Access restricted to providers.");
            return;
          }

          if (response.status === 503) {
            setErrorMsg(locale === "fr" ? "Service indisponible." : "Service unavailable.");
            return;
          }

          setErrorMsg(toErrorMessage(data, locale === "fr" ? "Erreur serveur." : "Server error."));
          return;
        }

        setPayouts(Array.isArray(data) ? (data as Payout[]) : []);
      } catch {
        if (!cancelled) {
          setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (view === "proposals") {
      void loadProposals();
    } else {
      void loadPayouts();
    }

    return () => {
      cancelled = true;
    };
  }, [locale, view]);

  function goToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            {view === "proposals"
              ? locale === "fr"
                ? "Mes propositions"
                : "My proposals"
              : locale === "fr"
                ? "Mes payouts"
                : "My payouts"}
          </h3>
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
            onClick={onClose}
          >
            {locale === "fr" ? "Fermer" : "Close"}
          </button>
        </div>

        <div className="mt-3 inline-flex gap-2 rounded-full border border-white/10 bg-zinc-950/70 p-1">
          <button
            type="button"
            onClick={() => setView("proposals")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              view === "proposals" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
            }`}
          >
            {locale === "fr" ? "Propositions" : "Proposals"}
          </button>
          <button
            type="button"
            onClick={() => setView("payouts")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              view === "payouts" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
            }`}
          >
            {locale === "fr" ? "Payouts" : "Payouts"}
          </button>
        </div>

        {loading && <p className="mt-3 text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
        {errorMsg && <p className="mt-3 text-sm text-rose-300">{errorMsg}</p>}

        {!loading && !errorMsg && view === "proposals" && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-xs text-zinc-200">
              <thead className="bg-zinc-950/70 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Service" : "Service"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Besoin" : "Need"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Statut" : "Status"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Date" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-zinc-900/60">
                {proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td className="px-3 py-2 align-top text-white">{proposal.service?.title ?? "-"}</td>
                    <td className="px-3 py-2 align-top">{proposal.need?.title ?? "-"}</td>
                    <td className="px-3 py-2 align-top">{proposal.status}</td>
                    <td className="px-3 py-2 align-top">{formatDateLabel(proposal.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {proposals.length === 0 && (
              <div className="px-3 py-4 text-xs text-zinc-400">
                {locale === "fr" ? "Aucune proposition." : "No proposals."}
              </div>
            )}
          </div>
        )}

        {!loading && !errorMsg && view === "payouts" && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-xs text-zinc-200">
              <thead className="bg-zinc-950/70 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Date" : "Date"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Total" : "Total"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Fee" : "Fee"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Payout" : "Payout"}</th>
                  <th className="px-3 py-2 text-left font-medium">{locale === "fr" ? "Statut" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-zinc-900/60">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-3 py-2 align-top">{formatDateLabel(payout.createdAt, locale)}</td>
                    <td className="px-3 py-2 align-top text-white">
                      {formatAmount(payout.amountTotalCents, payout.currency)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {formatAmount(payout.platformFeeCents, payout.currency)}
                    </td>
                    <td className="px-3 py-2 align-top text-emerald-300">
                      {formatAmount(payout.providerPayoutCents, payout.currency)}
                    </td>
                    <td className="px-3 py-2 align-top">{payout.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {payouts.length === 0 && (
              <div className="px-3 py-4 text-xs text-zinc-400">
                {locale === "fr" ? "Aucun payout." : "No payout."}
              </div>
            )}
          </div>
        )}

        {!loading && requiresLogin && (
          <div className="mt-3">
            <button
              type="button"
              onClick={goToLogin}
              className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950"
            >
              {locale === "fr" ? "Se connecter" : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
