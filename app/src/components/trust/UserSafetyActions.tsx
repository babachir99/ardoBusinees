"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

type UserSafetyActionsProps = {
  userId: string;
  locale?: string;
  variant?: "inline" | "menu";
  onActionComplete?: () => void;
};

export default function UserSafetyActions({
  userId,
  locale = "fr",
  variant = "inline",
  onActionComplete,
}: UserSafetyActionsProps) {
  const isFr = locale === "fr";
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportCooldownUntil, setReportCooldownUntil] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trust/blocks?take=200", { cache: "no-store" });
        if (res.status === 401) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.ok) {
          const items = Array.isArray(data.blocks) ? data.blocks : [];
          setBlocked(items.some((item: { blockedId?: string } | null) => item?.blockedId === userId));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (reportCooldownUntil <= Date.now()) return;
    const timeout = window.setTimeout(() => setReportCooldownUntil(0), reportCooldownUntil - Date.now());
    return () => window.clearTimeout(timeout);
  }, [reportCooldownUntil]);

  const reportDisabled = reportLoading || reportCooldownUntil > Date.now();

  async function toggleBlock() {
    if (!blocked) {
      const confirmed = window.confirm(
        isFr
          ? "Confirmer le blocage de ce compte ? Vous ne pourrez plus etre contactes entre vous tant que ce compte reste bloque."
          : "Confirm blocking this account? You will no longer be able to contact each other until unblocked."
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(blocked ? `/api/trust/blocks/${encodeURIComponent(userId)}` : "/api/trust/blocks", {
        method: blocked ? "DELETE" : "POST",
        headers: blocked ? undefined : { "Content-Type": "application/json" },
        body: blocked ? undefined : JSON.stringify({ blockedUserId: userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.code || "Request failed");
      const next = !blocked;
      setBlocked(next);
      setMessage(next ? (isFr ? "Utilisateur bloque." : "User blocked.") : (isFr ? "Utilisateur debloque." : "User unblocked."));
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setLoading(false);
    }
  }

  async function submitQuickReport() {
    if (reportDisabled) return;

    setReportLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/trust/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: userId,
          reason: isFr ? "Signalement profil" : "Profile report",
          description: isFr
            ? "Signalement envoye depuis la fiche profil. Merci de verifier ce compte."
            : "Report sent from the profile card. Please review this account.",
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === "DUPLICATE_REPORT") {
        setMessage(isFr ? "Signalement deja envoye recemment." : "Report already sent recently.");
        setReportCooldownUntil(Date.now() + 10_000);
        return;
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || data?.code || "Request failed");
      }

      setMessage(isFr ? "Signalement recu." : "Report received.");
      setReportCooldownUntil(Date.now() + 10_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setReportLoading(false);
    }
  }

  if (!ready) {
    return <p className="text-xs text-zinc-500">{isFr ? "Chargement..." : "Loading..."}</p>;
  }

  if (variant === "menu") {
    return (
      <div className="grid gap-1" role="none">
        <button
          type="button"
          role="menuitem"
          onClick={() => void toggleBlock()}
          disabled={loading}
          className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
            blocked
              ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              : "bg-rose-400/20 text-rose-200 hover:bg-rose-400/30"
          } disabled:opacity-60`}
        >
          {loading
            ? isFr
              ? "Traitement..."
              : "Processing..."
            : blocked
            ? isFr
              ? "Debloquer"
              : "Unblock"
            : isFr
            ? "Bloquer"
            : "Block"}
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => void submitQuickReport()}
          disabled={reportDisabled}
          className="w-full rounded-lg border border-white/15 px-3 py-2 text-left text-xs font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reportLoading
            ? isFr
              ? "Signalement..."
              : "Reporting..."
            : isFr
            ? "Signaler ce compte"
            : "Report this account"}
        </button>

        <Link
          href={`/trust/report?reportedUserId=${encodeURIComponent(userId)}`}
          role="menuitem"
          className="rounded-lg px-3 py-2 text-left text-[11px] text-zinc-300 transition hover:bg-zinc-800/70 hover:text-white"
        >
          {isFr ? "Ouvrir le formulaire complet" : "Open full report form"}
        </Link>

        <Link
          href="/trust/security"
          role="menuitem"
          className="rounded-lg px-3 py-2 text-left text-[11px] text-zinc-500 transition hover:bg-zinc-800/70 hover:text-zinc-200"
        >
          {isFr ? "Pourquoi bloquer ?" : "Why block?"}
        </Link>

        {message ? <p className="px-1 text-[11px] text-emerald-300">{message}</p> : null}
        {error ? <p className="px-1 text-[11px] text-rose-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void submitQuickReport()}
        disabled={reportDisabled}
        className="inline-flex w-fit rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {reportLoading
          ? isFr
            ? "Signalement..."
            : "Reporting..."
          : isFr
          ? "Signaler ce compte"
          : "Report this account"}
      </button>

      <Link
        href={`/trust/report?reportedUserId=${encodeURIComponent(userId)}`}
        className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
      >
        {isFr ? "Ouvrir le formulaire complet" : "Open full report form"}
      </Link>

      {message ? <p className="basis-full text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="basis-full text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
