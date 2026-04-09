"use client";

import { useEffect, useMemo, useState } from "react";

type ReportListingButtonProps = {
  locale: string;
  productId: string;
  productTitle: string;
  imageUrl?: string | null;
  isAuthenticated: boolean;
  variant?: "full" | "icon";
  className?: string;
};

const REPORT_REASON_OPTIONS = [
  "SCAM",
  "MISLEADING",
  "PROHIBITED",
  "DUPLICATE",
  "ABUSE",
  "OTHER",
] as const;

type SubmitState = "idle" | "loading" | "success" | "error";

export default function ReportListingButton({
  locale,
  productId,
  productTitle,
  imageUrl,
  isAuthenticated,
  variant = "full",
  className,
}: ReportListingButtonProps) {
  const isFr = locale === "fr";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASON_OPTIONS)[number]>("MISLEADING");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const reasonLabels = useMemo(
    () => ({
      SCAM: isFr ? "Arnaque ou faux produit" : "Scam or fake listing",
      MISLEADING: isFr ? "Annonce trompeuse" : "Misleading listing",
      PROHIBITED: isFr ? "Contenu interdit" : "Prohibited content",
      DUPLICATE: isFr ? "Doublon ou spam" : "Duplicate or spam",
      ABUSE: isFr ? "Visuel choquant / abusif" : "Abusive or offensive visual",
      OTHER: isFr ? "Autre" : "Other",
    }),
    [isFr]
  );

  const submitReport = async () => {
    setState("loading");
    setError(null);

    try {
      const response = await fetch("/api/product-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          reason,
          description,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; code?: string }
        | null;

      if (!response.ok) {
        if (response.status === 409 && data?.code === "DUPLICATE_ACTIVE_REPORT") {
          throw new Error(
            isFr
              ? "Cette annonce est deja signalee de votre cote."
              : "You already have an active report for this listing."
          );
        }

        if (response.status === 400 && data?.code === "SELF_REPORT_BLOCKED") {
          throw new Error(
            isFr
              ? "Vous ne pouvez pas signaler votre propre annonce."
              : "You cannot report your own listing."
          );
        }

        throw new Error(
          data?.error ||
            (isFr ? "Impossible d'envoyer le signalement." : "Unable to submit report.")
        );
      }

      setState("success");
      setDescription("");
      window.setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 1400);
    } catch (caughtError) {
      setState("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isFr
            ? "Impossible d'envoyer le signalement."
            : "Unable to submit report."
      );
    }
  };

  return (
    <>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          className={
            className ??
            (variant === "icon"
              ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/55 text-rose-200 shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-rose-300/35 hover:bg-rose-400/15 hover:text-white"
              : "w-full whitespace-nowrap rounded-xl border border-white/20 bg-zinc-900/70 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-rose-300/45 hover:bg-zinc-900")
          }
          aria-label={isFr ? "Signaler l'annonce" : "Report listing"}
          title={isFr ? "Signaler l'annonce" : "Report listing"}
        >
          {variant === "icon" ? (
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M6 4.75v10.5M6 5.25h6.5l-1.9 2.85 1.9 2.9H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            isFr ? "Signaler l'annonce" : "Report listing"
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.assign(`/${locale}/login`);
          }}
          className={
            className ??
            (variant === "icon"
              ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/55 text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              : "block w-full whitespace-nowrap rounded-xl border border-white/20 bg-zinc-900/70 px-4 py-2.5 text-center text-sm font-medium text-zinc-100 transition hover:border-rose-300/45 hover:bg-zinc-900")
          }
          aria-label={
            isFr ? "Se connecter pour signaler l'annonce" : "Sign in to report listing"
          }
          title={
            isFr ? "Se connecter pour signaler l'annonce" : "Sign in to report listing"
          }
        >
          {variant === "icon" ? (
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M6 4.75v10.5M6 5.25h6.5l-1.9 2.85 1.9 2.9H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            isFr ? "Se connecter pour signaler" : "Sign in to report"
          )}
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-[1] w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,22,26,0.98)_0%,rgba(10,12,15,0.98)_100%)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/85">
                  {isFr ? "Signalement" : "Report"}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {isFr ? "Signaler cette annonce" : "Report this listing"}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {isFr
                    ? "L'equipe admin reverra le contenu avec son visuel et votre motif."
                    : "The admin team will review the listing together with its visual and your reason."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                aria-label={isFr ? "Fermer" : "Close"}
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="m6 6 8 8M14 6l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={productTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                      {isFr ? "Visuel" : "Visual"}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-white">{productTitle}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {isFr ? "Le signalement reste confidentiel." : "Your report stays confidential."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                  {isFr ? "Motif" : "Reason"}
                </span>
                <select
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value as (typeof REPORT_REASON_OPTIONS)[number])
                  }
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-rose-300/30"
                >
                  {REPORT_REASON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {reasonLabels[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                  {isFr ? "Details" : "Details"}
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  maxLength={600}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-rose-300/30"
                  placeholder={
                    isFr
                      ? "Explique en quelques mots ce qui pose probleme."
                      : "Briefly explain what is wrong with this listing."
                  }
                />
              </label>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {state === "success" ? (
                <p className="text-sm text-emerald-300">
                  {isFr
                    ? "Signalement envoye. Merci pour votre vigilance."
                    : "Report sent. Thanks for helping keep things safe."}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
              >
                {isFr ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={state === "loading" || state === "success"}
                className="rounded-full bg-rose-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "loading"
                  ? isFr
                    ? "Envoi..."
                    : "Sending..."
                  : isFr
                    ? "Envoyer"
                    : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
