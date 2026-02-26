"use client";

import { useState, type FormEvent } from "react";

const verticals = ["SHOP", "PRESTA", "GP", "TIAK", "IMMO", "CARS"] as const;

export default function TrustDisputeForm({ locale }: { locale: string }) {
  const [vertical, setVertical] = useState<(typeof verticals)[number]>("SHOP");
  const [orderId, setOrderId] = useState("");
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
      const res = await fetch("/api/trust/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical, orderId: orderId.trim() || null, reason, description }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.code || "Request failed");
      setMessage(isFr ? "Plainte envoyee." : "Dispute submitted.");
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="text-zinc-300">{isFr ? "Verticale" : "Vertical"}</span>
          <select value={vertical} onChange={(e) => setVertical(e.target.value as any)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white">
            {verticals.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-zinc-300">{isFr ? "Order/Reference ID (optionnel)" : "Order/reference ID (optional)"}</span>
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" />
        </label>
      </div>
      <label className="grid gap-2 text-sm">
        <span className="text-zinc-300">{isFr ? "Raison" : "Reason"}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" minLength={3} maxLength={120} required />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-zinc-300">{isFr ? "Description" : "Description"}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-32 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" minLength={10} maxLength={2000} required />
      </label>
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button type="submit" disabled={loading} className="inline-flex w-fit rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
        {loading ? (isFr ? "Envoi..." : "Submitting...") : (isFr ? "Envoyer la plainte" : "Submit dispute")}
      </button>
    </form>
  );
}
