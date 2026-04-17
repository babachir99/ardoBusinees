"use client";

import { useMemo, useState } from "react";

type PaymentMethod = "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH";
type TripStatus = "OPEN" | "CLOSED" | "CANCELED";

type ManagedTrip = {
  id: string;
  originCity: string;
  destinationCity: string;
  flightDate: string;
  availableKg: number;
  pricePerKgCents: number;
  currency: string;
  status: TripStatus;
  isActive: boolean;
  maxPackages: number | null;
  contactPhone: string | null;
  notes: string | null;
  acceptedPaymentMethods: PaymentMethod[];
};

type Props = {
  locale: string;
  trips: ManagedTrip[];
};

type EditState = {
  originCity: string;
  destinationCity: string;
  flightDate: string;
  availableKg: string;
  pricePerKgCents: string;
  maxPackages: string;
  contactPhone: string;
  notes: string;
  acceptedPaymentMethods: PaymentMethod[];
};

const paymentOptions: Array<{ value: PaymentMethod; fr: string; en: string }> = [
  { value: "WAVE", fr: "Wave", en: "Wave" },
  { value: "ORANGE_MONEY", fr: "Orange Money", en: "Orange Money" },
  { value: "CARD", fr: "Carte", en: "Card" },
  { value: "CASH", fr: "Especes", en: "Cash" },
];

function toDateInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function makeEditState(trip: ManagedTrip): EditState {
  return {
    originCity: trip.originCity,
    destinationCity: trip.destinationCity,
    flightDate: toDateInput(trip.flightDate),
    availableKg: String(trip.availableKg),
    pricePerKgCents: String(trip.pricePerKgCents),
    maxPackages: trip.maxPackages ? String(trip.maxPackages) : "",
    contactPhone: trip.contactPhone ?? "",
    notes: trip.notes ?? "",
    acceptedPaymentMethods: trip.acceptedPaymentMethods,
  };
}

function formatDate(locale: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  });
}

function formatMoney(locale: string, amount: number, currency: string) {
  if (currency === "XOF") {
    return `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(amount)} FCFA`;
  }

  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function GpTripsManagerPanel({ locale, trips }: Props) {
  const [items, setItems] = useState(trips);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedTrips = useMemo(
    () =>
      [...items].sort(
        (left, right) => new Date(left.flightDate).getTime() - new Date(right.flightDate).getTime()
      ),
    [items]
  );

  function openEditor(trip: ManagedTrip) {
    setEditingId(trip.id);
    setEdit(makeEditState(trip));
    setError(null);
    setNotice(null);
  }

  function closeEditor() {
    setEditingId(null);
    setEdit(null);
  }

  function updateEdit<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEdit((current) => (current ? { ...current, [key]: value } : current));
  }

  function togglePayment(method: PaymentMethod) {
    setEdit((current) => {
      if (!current) return current;
      const exists = current.acceptedPaymentMethods.includes(method);
      return {
        ...current,
        acceptedPaymentMethods: exists
          ? current.acceptedPaymentMethods.filter((entry) => entry !== method)
          : [...current.acceptedPaymentMethods, method],
      };
    });
  }

  async function saveTrip(tripId: string) {
    if (!edit || savingId) return;

    setSavingId(tripId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/gp/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCity: edit.originCity,
          destinationCity: edit.destinationCity,
          flightDate: edit.flightDate,
          availableKg: Number(edit.availableKg),
          pricePerKgCents: Number(edit.pricePerKgCents),
          maxPackages: edit.maxPackages.trim() ? Number(edit.maxPackages) : null,
          contactPhone: edit.contactPhone.trim() || null,
          notes: edit.notes.trim() || null,
          acceptedPaymentMethods: edit.acceptedPaymentMethods,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            originCity?: string;
            destinationCity?: string;
            flightDate?: string;
            availableKg?: number;
            pricePerKgCents?: number;
            maxPackages?: number | null;
            contactPhone?: string | null;
            notes?: string | null;
            acceptedPaymentMethods?: PaymentMethod[];
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (locale === "fr"
              ? "Impossible de mettre a jour ce trajet."
              : "Unable to update this trip.")
        );
      }

      setItems((current) =>
        current.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                originCity: payload?.originCity ?? trip.originCity,
                destinationCity: payload?.destinationCity ?? trip.destinationCity,
                flightDate: payload?.flightDate ?? trip.flightDate,
                availableKg: payload?.availableKg ?? trip.availableKg,
                pricePerKgCents: payload?.pricePerKgCents ?? trip.pricePerKgCents,
                maxPackages:
                  payload?.maxPackages !== undefined ? payload.maxPackages : trip.maxPackages,
                contactPhone:
                  payload?.contactPhone !== undefined ? payload.contactPhone : trip.contactPhone,
                notes: payload?.notes !== undefined ? payload.notes : trip.notes,
                acceptedPaymentMethods:
                  payload?.acceptedPaymentMethods ?? trip.acceptedPaymentMethods,
              }
            : trip
        )
      );

      setNotice(locale === "fr" ? "Trajet mis a jour." : "Trip updated.");
      closeEditor();
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

  async function updateStatus(tripId: string, status: "OPEN" | "CLOSED") {
    if (savingId) return;
    setSavingId(tripId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/gp/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; status?: TripStatus; isActive?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (locale === "fr"
              ? "Impossible de changer le statut."
              : "Unable to change trip status.")
        );
      }

      setItems((current) =>
        current.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                status: (payload?.status as TripStatus | undefined) ?? status,
                isActive: payload?.isActive ?? (status === "OPEN"),
              }
            : trip
        )
      );
      setNotice(
        status === "OPEN"
          ? locale === "fr"
            ? "Trajet rouvert."
            : "Trip reopened."
          : locale === "fr"
          ? "Trajet ferme."
          : "Trip closed."
      );
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

  async function deleteTrip(tripId: string) {
    if (savingId) return;
    setSavingId(tripId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/gp/trips/${tripId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (locale === "fr" ? "Suppression impossible." : "Unable to delete trip.")
        );
      }

      setItems((current) => current.filter((trip) => trip.id !== tripId));
      setNotice(locale === "fr" ? "Trajet supprime." : "Trip deleted.");
      if (editingId === tripId) {
        closeEditor();
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
            {locale === "fr" ? "Mes trajets GP" : "My GP trips"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr"
              ? "Mets a jour tes disponibilites, ferme un trajet ou supprime-le s'il n'a encore aucune reservation."
              : "Update availability, close a trip, or delete it before bookings exist."}
          </p>
        </div>
      </div>

      {notice ? <p className="mt-4 text-sm text-emerald-200">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {sortedTrips.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          {locale === "fr" ? "Aucun trajet publie pour l'instant." : "No trips published yet."}
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {sortedTrips.map((trip) => {
            const isEditing = editingId === trip.id && edit;
            const isOpen = trip.status === "OPEN";

            return (
              <article
                key={trip.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-xs text-zinc-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {trip.originCity} {"->"} {trip.destinationCity}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                      <span>{formatDate(locale, trip.flightDate)}</span>
                      <span>{trip.availableKg}kg</span>
                      <span>{formatMoney(locale, trip.pricePerKgCents, trip.currency)}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                      trip.status === "OPEN"
                        ? "bg-emerald-400/20 text-emerald-200"
                        : trip.status === "CLOSED"
                        ? "bg-amber-400/20 text-amber-200"
                        : "bg-rose-400/20 text-rose-200"
                    }`}
                  >
                    {trip.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditor(trip)}
                    disabled={savingId === trip.id}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:border-cyan-300/55"
                  >
                    {locale === "fr" ? "Editer" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStatus(trip.id, isOpen ? "CLOSED" : "OPEN")}
                    disabled={savingId === trip.id}
                    className="rounded-full border border-amber-300/30 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition hover:border-amber-300/60 disabled:opacity-60"
                  >
                    {isOpen
                      ? locale === "fr"
                        ? "Fermer"
                        : "Close"
                      : locale === "fr"
                      ? "Rouvrir"
                      : "Reopen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTrip(trip.id)}
                    disabled={savingId === trip.id}
                    className="rounded-full border border-rose-300/25 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:border-rose-300/55 disabled:opacity-60"
                  >
                    {locale === "fr" ? "Supprimer" : "Delete"}
                  </button>
                </div>

                {isEditing ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[11px] text-zinc-400">
                          {locale === "fr" ? "Ville de depart" : "Departure city"}
                        </span>
                        <input
                          value={edit.originCity}
                          onChange={(event) => updateEdit("originCity", event.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-zinc-400">
                          {locale === "fr" ? "Ville d'arrivee" : "Arrival city"}
                        </span>
                        <input
                          value={edit.destinationCity}
                          onChange={(event) => updateEdit("destinationCity", event.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-zinc-400">
                          {locale === "fr" ? "Date de depart" : "Departure date"}
                        </span>
                        <input
                          type="date"
                          value={edit.flightDate}
                          onChange={(event) => updateEdit("flightDate", event.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-zinc-400">Kg</span>
                        <input
                          type="number"
                          min={1}
                          value={edit.availableKg}
                          onChange={(event) => updateEdit("availableKg", event.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-zinc-400">
                          {locale === "fr" ? "Prix / kg" : "Price / kg"}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={edit.pricePerKgCents}
                          onChange={(event) => updateEdit("pricePerKgCents", event.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-zinc-400">
                          {locale === "fr" ? "Max colis" : "Max parcels"}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={edit.maxPackages}
                          onChange={(event) => updateEdit("maxPackages", event.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                        />
                      </label>
                    </div>

                    <label className="space-y-1">
                      <span className="text-[11px] text-zinc-400">
                        {locale === "fr" ? "Telephone contact" : "Contact phone"}
                      </span>
                      <input
                        value={edit.contactPhone}
                        onChange={(event) => updateEdit("contactPhone", event.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-white"
                      />
                    </label>

                    <div className="space-y-2">
                      <p className="text-[11px] text-zinc-400">
                        {locale === "fr" ? "Paiements acceptes" : "Accepted payments"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {paymentOptions.map((option) => {
                          const selected = edit.acceptedPaymentMethods.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => togglePayment(option.value)}
                              className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                                selected
                                  ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100"
                                  : "border-white/10 text-zinc-300 hover:border-white/40"
                              }`}
                            >
                              {locale === "fr" ? option.fr : option.en}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="space-y-1">
                      <span className="text-[11px] text-zinc-400">
                        {locale === "fr" ? "Notes" : "Notes"}
                      </span>
                      <textarea
                        value={edit.notes}
                        onChange={(event) => updateEdit("notes", event.target.value)}
                        className="min-h-24 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveTrip(trip.id)}
                        disabled={savingId === trip.id}
                        className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
                      >
                        {savingId === trip.id
                          ? locale === "fr"
                            ? "Sauvegarde..."
                            : "Saving..."
                          : locale === "fr"
                          ? "Enregistrer"
                          : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={closeEditor}
                        disabled={savingId === trip.id}
                        className="rounded-full border border-white/15 px-4 py-2 text-[11px] font-semibold text-zinc-200 transition hover:border-white/35"
                      >
                        {locale === "fr" ? "Annuler" : "Cancel"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
