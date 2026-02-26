"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export default function UserSafetyActions({ userId, locale = "fr" }: { userId: string; locale?: string }) {
  const isFr = locale === "fr";
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trust/blocks?take=200", { cache: "no-store" });
        if (res.status === 401) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.ok) {
          const items = Array.isArray(data.blocks) ? data.blocks : [];
          setBlocked(items.some((item: any) => item?.blockedId === userId));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggleBlock() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : (isFr ? "Erreur serveur." : "Server error."));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <p className="text-xs text-zinc-500">{isFr ? "Chargement..." : "Loading..."}</p>;

  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{isFr ? "Securite" : "Safety"}</p>
      <button type="button" onClick={toggleBlock} disabled={loading} className={`inline-flex w-fit rounded-full px-4 py-2 text-xs font-semibold ${blocked ? "bg-zinc-700 text-white" : "bg-rose-400 text-zinc-950"} disabled:opacity-60`}>
        {loading ? (isFr ? "Traitement..." : "Processing...") : blocked ? (isFr ? "Debloquer" : "Unblock") : (isFr ? "Bloquer" : "Block user")}
      </button>
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      <Link
        href={`/trust/report?reportedUserId=${encodeURIComponent(userId)}`}
        className="inline-flex w-fit rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-white/30"
      >
        {isFr ? "Signaler ce compte" : "Report this account"}
      </Link>
    </div>
  );
}
