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

type Props = {
  onClose: () => void;
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

export default function PrestaProviderProposalsPanel({ onClose }: Props) {
  const pathname = usePathname();
  const locale = useMemo(() => (pathname?.startsWith("/fr") ? "fr" : "en"), [pathname]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

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
            return;
          }

          if (response.status === 403) {
            setErrorMsg(locale === "fr" ? "Accès réservé prestataires." : "Access restricted to providers.");
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  function goToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            {locale === "fr" ? "Mes propositions" : "My proposals"}
          </h3>
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
            onClick={onClose}
          >
            {locale === "fr" ? "Fermer" : "Close"}
          </button>
        </div>

        {loading && <p className="mt-3 text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
        {errorMsg && <p className="mt-3 text-sm text-rose-300">{errorMsg}</p>}

        {!loading && !errorMsg && (
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

        {!loading && errorMsg?.includes("Connecte") && (
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
