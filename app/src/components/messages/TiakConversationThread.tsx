"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TiakDelivery, type TiakDeliveryEvent } from "@/components/tiak/types";

type Props = {
  locale: string;
  meId: string;
  deliveryId: string;
};

function formatDate(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
}

function parseRatingNote(note: string | null) {
  if (!note) return null;
  const match = /^RATING:(\d)(?:\|(.*))?$/i.exec(note.trim());
  if (!match) return null;
  const rating = Number(match[1]);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const comment = typeof match[2] === "string" ? match[2].trim() : "";
  return { rating, comment };
}

const SYSTEM_NOTES = new Set([
  "Courier assigned",
  "Courier accepted assignment",
  "Courier declined assignment",
  "Assignment expired",
]);

function isSystemTiakNote(note: string | null) {
  if (!note) return false;
  return SYSTEM_NOTES.has(note.trim());
}

function toErrorMessage(data: unknown, fallback: string) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof record?.error === "string") return record.error;
  if (typeof record?.message === "string") return record.message;
  return fallback;
}

function formatEventNarrative(params: {
  locale: string;
  event: TiakDeliveryEvent;
  delivery: TiakDelivery;
  meId: string;
}) {
  const { locale, event, delivery, meId } = params;
  const isFr = locale === "fr";
  const customerName = delivery.customer?.name ?? (isFr ? "Le client" : "The customer");
  const courierName = delivery.courier?.name ?? (isFr ? "Le coursier" : "The courier");
  const actorName = event.actor?.name ?? (event.actorId === delivery.customerId ? customerName : courierName);
  const ratingInfo = parseRatingNote(event.note);

  if (ratingInfo) {
    if (meId === delivery.courierId) {
      return isFr
        ? `${customerName} vous a attribue ${ratingInfo.rating}/5.${ratingInfo.comment ? ` ${ratingInfo.comment}` : ""}`
        : `${customerName} rated you ${ratingInfo.rating}/5.${ratingInfo.comment ? ` ${ratingInfo.comment}` : ""}`;
    }

    return isFr
      ? `Note attribuee: ${ratingInfo.rating}/5.${ratingInfo.comment ? ` ${ratingInfo.comment}` : ""}`
      : `Rating submitted: ${ratingInfo.rating}/5.${ratingInfo.comment ? ` ${ratingInfo.comment}` : ""}`;
  }

  if (event.note && event.note.trim().length > 0 && !isSystemTiakNote(event.note)) {
    return event.note;
  }

  if (event.status === "ASSIGNED") {
    if (meId === delivery.courierId) {
      return isFr
        ? `${customerName} veut que vous livriez son colis. Acceptez-vous ?`
        : `${customerName} wants you to deliver the parcel. Do you accept?`;
    }
    return isFr
      ? `Votre demande est assignee a ${courierName}.`
      : `Your request has been assigned to ${courierName}.`;
  }

  if (event.status === "ACCEPTED") {
    return meId === delivery.customerId
      ? isFr
        ? `${courierName} a accepte votre demande.`
        : `${courierName} accepted your request.`
      : isFr
        ? "Vous avez accepte la course."
        : "You accepted the delivery.";
  }

  if (event.status === "PICKED_UP") {
    return meId === delivery.customerId
      ? isFr
        ? `${courierName} a recupere le colis.`
        : `${courierName} picked up the parcel.`
      : isFr
        ? "Colis recupere."
        : "Parcel picked up.";
  }

  if (event.status === "DELIVERED") {
    return meId === delivery.customerId
      ? isFr
        ? `${courierName} a marque la livraison comme terminee. Merci de confirmer.`
        : `${courierName} marked delivery as completed. Please confirm receipt.`
      : isFr
        ? "Livraison marquee comme terminee."
        : "Delivery marked as completed.";
  }

  if (event.status === "COMPLETED") {
    return meId === delivery.courierId
      ? isFr
        ? "Le client a confirme la livraison."
        : "The customer confirmed the delivery."
      : isFr
        ? "Vous avez confirme la livraison."
        : "You confirmed the delivery.";
  }

  if (event.status === "REJECTED") {
    return isFr
      ? `${actorName} a refuse l'assignation.`
      : `${actorName} declined the assignment.`;
  }

  if (event.status === "CANCELED") {
    return isFr
      ? `${actorName} a annule la course.`
      : `${actorName} canceled the delivery.`;
  }

  return event.status;
}

export default function TiakConversationThread({ locale, meId, deliveryId }: Props) {
  const isFr = locale === "fr";
  const [delivery, setDelivery] = useState<TiakDelivery | null>(null);
  const [events, setEvents] = useState<TiakDeliveryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSending, setRatingSending] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const [deliveryRes, eventsRes] = await Promise.all([
          fetch(`/api/tiak-tiak/deliveries/${deliveryId}?includeAddress=1`, { cache: "no-store" }),
          fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, { cache: "no-store" }),
        ]);

        const deliveryData = await deliveryRes.json().catch(() => null);
        if (!deliveryRes.ok || !deliveryData) {
          throw new Error(isFr ? "Conversation indisponible." : "Conversation unavailable.");
        }

        const eventsData = await eventsRes.json().catch(() => []);
        if (!eventsRes.ok) {
          throw new Error(isFr ? "Timeline indisponible." : "Timeline unavailable.");
        }

        setDelivery(deliveryData as TiakDelivery);
        setEvents(Array.isArray(eventsData) ? (eventsData as TiakDeliveryEvent[]) : []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : isFr ? "Erreur de chargement." : "Loading error.");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [deliveryId, isFr]
  );

  useEffect(() => {
    void loadThread(false);
  }, [loadThread]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadThread(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  const hasSubmittedRating = useMemo(() => {
    if (!delivery) return false;
    return events.some((event) => event.actorId === meId && parseRatingNote(event.note));
  }, [delivery, events, meId]);

  const canRate = Boolean(
    delivery &&
      meId === delivery.customerId &&
      delivery.status === "COMPLETED" &&
      !hasSubmittedRating
  );

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: message }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          toErrorMessage(data, isFr ? "Impossible d'envoyer le message." : "Unable to send message.")
        );
      }

      setDraft("");
      setSendSuccess(isFr ? "Message envoye." : "Message sent.");
      await loadThread(true);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setSending(false);
    }
  };

  const submitRating = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRate || ratingSending) return;

    setRatingSending(true);
    setRatingError(null);
    setRatingSuccess(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          note: ratingComment.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          toErrorMessage(data, isFr ? "Impossible d'envoyer la note." : "Unable to submit rating.")
        );
      }

      setRatingComment("");
      setRatingSuccess(isFr ? "Note envoyee." : "Rating submitted.");
      await loadThread(true);
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setRatingSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {isFr ? "Fil course" : "Delivery thread"}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">
            {delivery ? `${delivery.pickupArea} -> ${delivery.dropoffArea}` : `#${deliveryId.slice(0, 8)}`}
          </h3>
        </div>

        <a
          href={`/stores/jontaado-tiak-tiak?deliveryId=${encodeURIComponent(deliveryId)}`}
          className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60"
        >
          {isFr ? "Ouvrir detail ops" : "Open ops details"}
        </a>
      </div>

      <p className="mt-2 text-[11px] text-zinc-500">
        {isFr ? "Synchronise automatiquement toutes les 5 secondes." : "Auto-sync every 5 seconds."}
      </p>

      <div className="mt-3 h-[360px] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
        {loading ? (
          <p className="text-xs text-zinc-400">{isFr ? "Chargement..." : "Loading..."}</p>
        ) : loadError ? (
          <p className="text-xs text-rose-300">{loadError}</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-zinc-500">{isFr ? "Aucun message pour le moment." : "No messages yet."}</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const mine = event.actorId === meId;
              const ratingInfo = parseRatingNote(event.note);

              return (
                <article
                  key={event.id}
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    mine
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                      : "border-white/10 bg-zinc-900 text-zinc-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-400">{event.actor?.name || (isFr ? "Utilisateur" : "User")}</p>
                    <p className="text-[10px] text-zinc-500">{formatDate(event.createdAt, locale)}</p>
                  </div>
                  {ratingInfo ? (
                    <span className="mt-1 inline-flex rounded-full border border-amber-300/45 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      {isFr ? "Note" : "Rating"}: {ratingInfo.rating}/5
                    </span>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {delivery ? formatEventNarrative({ locale, event, delivery, meId }) : event.note || event.status}
                  </p>
                  {event.proofUrl ? (
                    <a
                      href={event.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-[11px] text-emerald-300 underline"
                    >
                      {isFr ? "Voir preuve" : "Open proof"}
                    </a>
                  ) : null}
                </article>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {canRate ? (
        <form onSubmit={submitRating} className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-xs font-semibold text-amber-100">{isFr ? "Noter le coursier" : "Rate courier"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                  rating === value
                    ? "border-amber-200 bg-amber-200/20 text-amber-100"
                    : "border-white/20 text-zinc-200 hover:border-amber-200/50"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <textarea
            value={ratingComment}
            onChange={(event) => setRatingComment(event.target.value)}
            maxLength={280}
            rows={2}
            placeholder={isFr ? "Commentaire optionnel" : "Optional comment"}
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={ratingSending}
              className="rounded-lg border border-amber-300/45 bg-amber-300/15 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-60"
            >
              {ratingSending ? (isFr ? "Envoi..." : "Submitting...") : isFr ? "Envoyer la note" : "Submit rating"}
            </button>
            {ratingSuccess ? <span className="text-xs text-emerald-300">{ratingSuccess}</span> : null}
          </div>
          {ratingError ? <p className="mt-1 text-xs text-rose-300">{ratingError}</p> : null}
        </form>
      ) : null}

      <form onSubmit={sendMessage} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isFr ? "Ecris ton message..." : "Write your message..."}
          className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {sending ? (isFr ? "Envoi..." : "Sending...") : isFr ? "Envoyer" : "Send"}
        </button>
      </form>
      {sendSuccess ? <p className="mt-2 text-xs text-emerald-300">{sendSuccess}</p> : null}
      {sendError ? <p className="mt-1 text-xs text-rose-300">{sendError}</p> : null}
    </section>
  );
}
