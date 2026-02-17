"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";

type BookingStatus =
  | "DRAFT"
  | "PENDING"
  | "ACCEPTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "DELIVERED"
  | "CANCELED"
  | "REJECTED";

type GpTripBookingFormProps = {
  tripId: string;
  locale: string;
  isLoggedIn: boolean;
  isOwner: boolean;
  initialStatus?: BookingStatus | null;
  secondaryActions?: ReactNode;
  actionRowClassName?: string;
};

const confirmedStatuses = new Set<BookingStatus>([
  "ACCEPTED",
  "CONFIRMED",
  "COMPLETED",
  "DELIVERED",
]);

const statusMeta: Record<
  BookingStatus,
  {
    fr: string;
    en: string;
    className: string;
  }
> = {
  DRAFT: {
    fr: "Brouillon",
    en: "Draft",
    className: "border-zinc-500/40 bg-zinc-500/15 text-zinc-200",
  },
  PENDING: {
    fr: "En attente de confirmation",
    en: "Awaiting confirmation",
    className: "border-amber-400/40 bg-amber-400/15 text-amber-100",
  },
  ACCEPTED: {
    fr: "Acceptee",
    en: "Accepted",
    className: "border-cyan-400/40 bg-cyan-400/15 text-cyan-100",
  },
  CONFIRMED: {
    fr: "Confirmee",
    en: "Confirmed",
    className: "border-indigo-400/40 bg-indigo-400/15 text-indigo-100",
  },
  COMPLETED: {
    fr: "Terminee",
    en: "Completed",
    className: "border-emerald-400/40 bg-emerald-400/15 text-emerald-100",
  },
  DELIVERED: {
    fr: "Livree",
    en: "Delivered",
    className: "border-emerald-400/40 bg-emerald-400/15 text-emerald-100",
  },
  CANCELED: {
    fr: "Annulee",
    en: "Canceled",
    className: "border-rose-400/40 bg-rose-400/15 text-rose-100",
  },
  REJECTED: {
    fr: "Refusee",
    en: "Rejected",
    className: "border-rose-400/40 bg-rose-400/15 text-rose-100",
  },
};

export default function GpTripBookingForm({
  tripId,
  locale,
  isLoggedIn,
  isOwner,
  initialStatus,
  secondaryActions,
  actionRowClassName,
}: GpTripBookingFormProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [requestedKg, setRequestedKg] = useState("1");
  const [packageCount, setPackageCount] = useState("1");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<BookingStatus | null>(initialStatus ?? null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  if (isOwner) return null;

  const canContact = Boolean(status && confirmedStatuses.has(status));

  const submit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/gp/trips/${tripId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedKg: Number(requestedKg),
          packageCount: Number(packageCount),
          message,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (locale === "fr"
              ? "Reservation impossible pour le moment."
              : "Booking failed for now.")
        );
      }

      const nextStatus = payload?.booking?.status as BookingStatus | undefined;
      if (nextStatus) {
        setStatus(nextStatus);
      }

      setSuccess(
        locale === "fr"
          ? "Reservation envoyee. En attente de confirmation."
          : "Booking submitted. Waiting for confirmation."
      );
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "fr"
          ? "Erreur de reservation"
          : "Booking error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className={`fixed inset-0 z-[9998] transition-all duration-200 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 z-[9998] bg-black/70 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-0 z-[9999] flex items-end justify-center md:items-center md:p-6">
        <div
          className={`h-[100dvh] w-full overflow-hidden rounded-none border-y border-white/15 bg-zinc-900/95 shadow-2xl transition-all duration-200 md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-3xl md:border ${
            open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">
                  {locale === "fr" ? "Reserver ce trajet" : "Book this trip"}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/15 px-3 py-1 text-xs text-zinc-200"
                >
                  {locale === "fr" ? "Fermer" : "Close"}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-zinc-400">{locale === "fr" ? "Poids (kg)" : "Weight (kg)"}</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={requestedKg}
                      onChange={(event) => setRequestedKg(event.target.value)}
                      className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-zinc-400">{locale === "fr" ? "Nombre de colis" : "Parcels"}</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={packageCount}
                      onChange={(event) => setPackageCount(event.target.value)}
                      className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                    />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">{locale === "fr" ? "Message optionnel" : "Optional message"}</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={1200}
                    className="min-h-24 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="w-fit rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 disabled:opacity-60"
                >
                  {submitting
                    ? locale === "fr"
                      ? "Envoi..."
                      : "Sending..."
                    : locale === "fr"
                    ? "Confirmer"
                    : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const statusBadge = status ? statusMeta[status] : null;

  return (
    <div className="text-xs">
      <div className={actionRowClassName ?? "mt-4 flex flex-wrap items-center gap-2"}>
        {!isLoggedIn ? (
          <Link
            href="/login"
            className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            {locale === "fr" ? "Se connecter pour reserver" : "Sign in to book"}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-400 px-4 py-1.5 font-semibold text-zinc-950 shadow-[0_8px_22px_rgba(16,185,129,0.25)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
            aria-label={locale === "fr" ? "Reserver ce trajet" : "Book this trip"}
          >
            {locale === "fr" ? "Reserver" : "Book"}
          </button>
        )}

        {secondaryActions}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {statusBadge ? (
          <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusBadge.className}`}>
            {locale === "fr" ? statusBadge.fr : statusBadge.en}
          </span>
        ) : null}

        {canContact ? (
          <Link
            href={`/messages?tripId=${tripId}`}
            className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-300/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            {locale === "fr" ? "Contacter" : "Contact"}
          </Link>
        ) : null}
      </div>

      {success && <p className="mt-2 text-[11px] text-emerald-300">{success}</p>}
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}

      {mounted ? createPortal(modal, document.body) : null}
    </div>
  );
}
