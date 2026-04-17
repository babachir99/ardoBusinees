"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";

type PendingBooking = {
  id: string;
  tripId: string;
  requestedKg: number;
  packageCount: number;
  message: string | null;
  createdAt: string;
  customer: {
    name: string | null;
  };
  trip: {
    originCity: string;
    destinationCity: string;
    flightDate: string;
    currency: string;
    pricePerKgCents: number;
  };
};

type Props = {
  locale: string;
  bookings: PendingBooking[];
};

function formatDate(locale: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  });
}

function formatMoney(locale: string, amount: number, currency: string) {
  if (currency === "XOF") {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(amount) + " FCFA";
  }

  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function GpPendingBookingsPanel({ locale, bookings }: Props) {
  const [items, setItems] = useState(bookings);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = items.length;

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [items]
  );

  async function decide(tripId: string, bookingId: string, status: "ACCEPTED" | "REJECTED") {
    if (savingId) return;

    setSavingId(bookingId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/gp/trips/${tripId}/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            shipment?: { code?: string | null };
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (locale === "fr"
              ? "Impossible de mettre a jour cette demande."
              : "Unable to update this booking.")
        );
      }

      setItems((current) => current.filter((item) => item.id !== bookingId));

      if (status === "ACCEPTED") {
        setNotice(
          locale === "fr"
            ? `Demande acceptee${payload?.shipment?.code ? ` (${payload.shipment.code})` : ""}.`
            : `Booking accepted${payload?.shipment?.code ? ` (${payload.shipment.code})` : ""}.`
        );
      } else {
        setNotice(locale === "fr" ? "Demande refusee." : "Booking rejected.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "fr"
          ? "Erreur inconnue."
          : "Unknown error."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {locale === "fr" ? "Demandes en attente" : "Pending requests"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr"
              ? "Accepte ou refuse les reservations avant qu'elles ne bloquent le parcours GP."
              : "Accept or reject bookings before they stall the GP flow."}
          </p>
        </div>
        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
          {pendingCount} {locale === "fr" ? "a traiter" : "to review"}
        </span>
      </div>

      {notice ? <p className="mt-4 text-sm text-emerald-200">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {sortedItems.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 p-5 text-sm text-zinc-400">
          {locale === "fr"
            ? "Aucune reservation en attente pour le moment."
            : "No pending bookings for now."}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sortedItems.map((booking) => {
            const amount = booking.requestedKg * booking.trip.pricePerKgCents;
            const customerName = booking.customer.name ?? (locale === "fr" ? "Client" : "Customer");

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{customerName}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {booking.trip.originCity} {"->"} {booking.trip.destinationCity}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase text-zinc-300">
                    {formatDate(locale, booking.createdAt)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-cyan-100">
                    {booking.requestedKg}kg
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {booking.packageCount} {locale === "fr" ? "colis" : "parcels"}
                  </span>
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-emerald-100">
                    {formatMoney(locale, amount, booking.trip.currency)}
                  </span>
                </div>

                {booking.message ? (
                  <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-zinc-300">
                    {booking.message}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void decide(booking.tripId, booking.id, "ACCEPTED")}
                    disabled={savingId === booking.id}
                    className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {savingId === booking.id
                      ? locale === "fr"
                        ? "Traitement..."
                        : "Processing..."
                      : locale === "fr"
                      ? "Accepter"
                      : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(booking.tripId, booking.id, "REJECTED")}
                    disabled={savingId === booking.id}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-rose-300/45 hover:text-rose-100 disabled:opacity-60"
                  >
                    {locale === "fr" ? "Refuser" : "Reject"}
                  </button>
                  <Link
                    href="/stores/jontaado-gp/shipments"
                    className="rounded-full border border-cyan-300/25 px-3 py-2 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-300/55"
                  >
                    {locale === "fr" ? "Voir le suivi" : "Open tracking"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
