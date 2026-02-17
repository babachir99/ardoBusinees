"use client";

import { useEffect, useState } from "react";
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
};

const confirmedStatuses = new Set<BookingStatus>([
  "ACCEPTED",
  "CONFIRMED",
  "COMPLETED",
  "DELIVERED",
]);

export default function GpTripBookingForm({
  tripId,
  locale,
  isLoggedIn,
  isOwner,
  initialStatus,
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

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
      {!isLoggedIn ? (
        <Link
          href="/login"
          className="rounded-full border border-white/20 px-3 py-1.5 font-semibold text-white transition hover:border-white/50"
        >
          {locale === "fr" ? "Se connecter pour reserver" : "Sign in to book"}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-emerald-400 px-3 py-1.5 font-semibold text-zinc-950"
        >
          {locale === "fr" ? "Reserver" : "Book"}
        </button>
      )}

      {canContact ? (
        <Link
          href={`/messages?tripId=${tripId}`}
          className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 font-semibold text-cyan-100 transition hover:border-cyan-300/80"
        >
          {locale === "fr" ? "Contacter" : "Contact"}
        </Link>
      ) : (
        <span className="text-[11px] text-zinc-500">
          {status
            ? locale === "fr"
              ? `Reservation: ${status}`
              : `Booking: ${status}`
            : locale === "fr"
            ? "Aucune reservation"
            : "No booking"}
        </span>
      )}

      {success && <p className="w-full text-[11px] text-emerald-300">{success}</p>}
      {error && <p className="w-full text-[11px] text-rose-300">{error}</p>}

      {mounted ? createPortal(modal, document.body) : null}
    </div>
  );
}
