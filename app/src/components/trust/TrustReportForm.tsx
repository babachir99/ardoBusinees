"use client";

import { useState, type FormEvent } from "react";

export default function TrustReportForm({ locale }: { locale: string }) {
  const [reportedUserId, setReportedUserId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFr = locale === "fr";

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const nextUrls: string[] = [];
      for (const file of Array.from(fileList).slice(0, 5)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok || typeof data?.url !== "string") {
          throw new Error(data?.message || data?.error || "Upload failed");
        }
        nextUrls.push(data.url);
      }
      setProofUrls((cur) => Array.from(new Set([...cur, ...nextUrls])).slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : isFr ? "Erreur upload" : "Upload error");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/trust/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId, reason, description, proofUrls }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.code || "Request failed");
      setMessage(isFr ? "Signalement envoye." : "Report submitted.");
      setReason("");
      setDescription("");
      setProofUrls([]);
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
      <label className="grid gap-2 text-sm">
        <span className="text-zinc-300">{isFr ? "Preuves (images/pdf, max 5)" : "Evidence (images/pdf, max 5)"}</span>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => void uploadFiles(event.target.files)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" />
      </label>
      {proofUrls.length > 0 && (
        <div className="grid gap-1 text-xs text-zinc-400">
          <p>{isFr ? "Preuves ajoutees" : "Evidence attached"}</p>
          {proofUrls.map((url) => (
            <div key={url} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-2 py-1">
              <span className="truncate">{url}</span>
              <button type="button" onClick={() => setProofUrls((cur) => cur.filter((item) => item !== url))} className="text-rose-300">{isFr ? "Retirer" : "Remove"}</button>
            </div>
          ))}
        </div>
      )}
      {uploading ? <p className="text-sm text-zinc-300">{isFr ? "Upload en cours..." : "Uploading..."}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button type="submit" disabled={loading || uploading} className="inline-flex w-fit rounded-full bg-rose-400 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
        {loading ? (isFr ? "Envoi..." : "Submitting...") : (isFr ? "Envoyer le signalement" : "Submit report")}
      </button>
    </form>
  );
}
