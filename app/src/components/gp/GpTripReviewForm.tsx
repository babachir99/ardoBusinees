"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";

type GpTripReviewFormProps = {
  tripId: string;
  locale: string;
  isLoggedIn: boolean;
  isOwner: boolean;
};

export default function GpTripReviewForm({
  tripId,
  locale,
  isLoggedIn,
  isOwner,
}: GpTripReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isOwner) {
    return null;
  }

  const cta = locale === "fr" ? "Noter le transporteur" : "Rate transporter";
  const closeLabel = locale === "fr" ? "Fermer" : "Close";

  const submit = async () => {
    if (sending) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/gp/trips/${tripId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title, comment }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error ||
            (locale === "fr" ? "Impossible d'enregistrer l'avis" : "Unable to save review")
        );
      }

      setSuccess(locale === "fr" ? "Merci, avis enregistre." : "Thanks, review saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "fr"
          ? "Erreur pendant l'envoi"
          : "Submission failed"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 text-xs text-zinc-300">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-400">
            {locale === "fr"
              ? "Partage ton retour sur ce transporteur"
              : "Share feedback about this transporter"}
          </p>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full border border-indigo-300/40 bg-indigo-300/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 transition hover:border-indigo-300/70"
            >
              {cta}
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:border-white/50"
            >
              {locale === "fr" ? "Se connecter pour noter" : "Sign in to rate"}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{cta}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-white/30"
            >
              {closeLabel}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`rounded-lg border px-2 py-1 text-[11px] ${
                  value <= rating
                    ? "border-amber-300/70 bg-amber-300/15 text-amber-200"
                    : "border-white/10 bg-zinc-900 text-zinc-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white outline-none transition focus:border-indigo-300/60"
            placeholder={locale === "fr" ? "Titre (optionnel)" : "Title (optional)"}
          />

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1200}
            className="min-h-20 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none transition focus:border-indigo-300/60"
            placeholder={locale === "fr" ? "Commentaire (optionnel)" : "Comment (optional)"}
          />

          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 disabled:opacity-60"
          >
            {sending
              ? locale === "fr"
                ? "Envoi..."
                : "Sending..."
              : locale === "fr"
              ? "Envoyer l'avis"
              : "Submit review"}
          </button>

          {success && <p className="text-[11px] text-emerald-300">{success}</p>}
          {error && <p className="text-[11px] text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
