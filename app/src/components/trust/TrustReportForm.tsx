"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

export default function TrustReportForm({ locale }: { locale: string }) {
  const [reportedUserId, setReportedUserId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFr = locale === "fr";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/trust/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId, reason, description }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.code || "Request failed");
      setMessage(isFr ? "Signalement envoye." : "Report submitted.");
      setReason("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : (isFr ? "Erreur serveur." : "Server error."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <label className="grid gap-2 text-sm">
        <span className="text-zinc-300">{isFr ? "ID utilisateur a signaler" : "Reported user ID"}</span>
        <input value={reportedUserId} onChange={(e) => setReportedUserId(e.target.value)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" placeholder="cuid..." required />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-zinc-300">{isFr ? "Raison" : "Reason"}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" minLength={3} maxLength={120} required />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-zinc-300">{isFr ? "Description" : "Description"}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-32 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" minLength={10} maxLength={2000} required />
      </label>
      <p className="text-xs text-zinc-500">{isFr ? "V0.1: piece jointe optionnelle non activee (placeholder)." : "V0.1: optional attachment not enabled yet (placeholder)."}</p>
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button type="submit" disabled={loading} className="inline-flex w-fit rounded-full bg-rose-400 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
        {loading ? (isFr ? "Envoi..." : "Submitting...") : (isFr ? "Envoyer le signalement" : "Submit report")}
      </button>
    </form>
  );
}
