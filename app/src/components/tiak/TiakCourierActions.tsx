"use client";

import { type FormEvent, useState } from "react";
import { type TiakDelivery, type TiakDeliveryStatus } from "@/components/tiak/types";

type Props = {
  locale: string;
  delivery: TiakDelivery;
  currentUserId: string | null;
  currentUserRole: string | null;
  onDeliveryUpdated: (delivery: TiakDelivery) => void;
};

export default function TiakCourierActions({
  locale,
  delivery,
  currentUserId,
  currentUserRole,
  onDeliveryUpdated,
}: Props) {
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<TiakDeliveryStatus | null>(null);
  const [postingEvent, setPostingEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN";
  const isCourierRole = currentUserRole === "COURIER" || isAdmin;
  const isAssignedCourier = Boolean(currentUserId && currentUserId === delivery.courierId);
  const canAccept = isCourierRole && delivery.status === "REQUESTED";
  const canPickUp = (isAssignedCourier || isAdmin) && delivery.status === "ACCEPTED";
  const canDeliver = (isAssignedCourier || isAdmin) && delivery.status === "PICKED_UP";
  const canAddProof = isAssignedCourier || isAdmin;

  if (!canAccept && !canPickUp && !canDeliver && !canAddProof) {
    return null;
  }

  async function patchStatus(status: TiakDeliveryStatus) {
    setSaving(status);
    setError(null);
    setEventMessage(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : locale === "fr" ? "Action refusee" : "Action denied");
        return;
      }

      onDeliveryUpdated(data as TiakDelivery);
    } catch {
      setError(locale === "fr" ? "Action refusee" : "Action denied");
    } finally {
      setSaving(null);
    }
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAddProof) return;

    setPostingEvent(true);
    setError(null);
    setEventMessage(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${delivery.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note || undefined,
          proofUrl: proofUrl || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : locale === "fr" ? "Preuve refusee" : "Proof rejected");
        return;
      }

      setEventMessage(locale === "fr" ? "Preuve ajoutee" : "Proof added");
      setProofUrl("");
      setNote("");
    } catch {
      setError(locale === "fr" ? "Preuve refusee" : "Proof rejected");
    } finally {
      setPostingEvent(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
        {locale === "fr" ? "Actions courier" : "Courier actions"}
      </p>

      <div className="flex flex-wrap gap-2">
        {canAccept && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => patchStatus("ACCEPTED")}
            className="rounded-lg border border-emerald-300/40 bg-emerald-300/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-60"
          >
            {saving === "ACCEPTED"
              ? locale === "fr"
                ? "En cours..."
                : "Updating..."
              : locale === "fr"
                ? "Accepter"
                : "Accept"}
          </button>
        )}

        {canPickUp && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => patchStatus("PICKED_UP")}
            className="rounded-lg border border-sky-300/40 bg-sky-300/15 px-3 py-1.5 text-xs font-semibold text-sky-200 disabled:opacity-60"
          >
            {saving === "PICKED_UP"
              ? locale === "fr"
                ? "En cours..."
                : "Updating..."
              : locale === "fr"
                ? "Marquer pickup"
                : "Mark picked up"}
          </button>
        )}

        {canDeliver && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => patchStatus("DELIVERED")}
            className="rounded-lg border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-60"
          >
            {saving === "DELIVERED"
              ? locale === "fr"
                ? "En cours..."
                : "Updating..."
              : locale === "fr"
                ? "Marquer livre"
                : "Mark delivered"}
          </button>
        )}
      </div>

      {canAddProof && (
        <form className="grid gap-2 md:grid-cols-2" onSubmit={submitEvent}>
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            proofUrl
            <input
              className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-2 text-xs text-white"
              value={proofUrl}
              onChange={(event) => setProofUrl(event.target.value)}
              placeholder="/uploads/tiak/proof.jpg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            {locale === "fr" ? "Note" : "Note"}
            <input
              className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-2 text-xs text-white"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={600}
            />
          </label>
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={postingEvent}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {postingEvent
                ? locale === "fr"
                  ? "Envoi..."
                  : "Submitting..."
                : locale === "fr"
                  ? "Ajouter une preuve"
                  : "Add proof"}
            </button>
            {eventMessage && <span className="text-xs text-emerald-300">{eventMessage}</span>}
          </div>
        </form>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
