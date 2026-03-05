"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type TiakDelivery, type TiakDeliveryEvent } from "@/components/tiak/types";

type Props = {
  locale: string;
  deliveryId: string;
  open: boolean;
  onClose: () => void;
  onDeliveryLoaded: (delivery: TiakDelivery) => void;
  isLoggedIn: boolean;
  currentUserId: string | null;
  currentUserRole: string | null;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function contactHintLabel(locale: string, paymentMethod: string | null, unlockHint?: string | null) {
  if (unlockHint === "BLOCKED_USER") {
    return locale === "fr" ? "Contact desactive (utilisateur bloque)." : "Contact disabled (blocked user).";
  }

  const isCash = paymentMethod === "CASH";
  const isUnset = paymentMethod === null;

  if (locale === "fr") {
    if (isUnset) return "Contact disponible apres ACCEPTED + choix du paiement";
    return isCash
      ? "Contact disponible apres ACCEPTED"
      : "Contact disponible apres ACCEPTED + paiement";
  }

  if (isUnset) return "Contact available after ACCEPTED + payment method selected";
  return isCash
    ? "Contact available after ACCEPTED"
    : "Contact available after ACCEPTED + payment";
}

function toErrorMessage(data: unknown, fallback: string) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof record?.error === "string") return record.error;
  if (typeof record?.message === "string") return record.message;
  return fallback;
}

function parseRatingNote(note: string | null) {
  if (!note) return null;
  const match = /^RATING:(\d)(?:\|(.*))?$/i.exec(note.trim());
  if (!match) return null;
  const rating = Number(match[1]);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const comment = typeof match[2] === "string" ? match[2].trim() : "";
  return {
    rating,
    comment,
  };
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

function formatTiakEventNarrative(params: {
  locale: string;
  event: TiakDeliveryEvent;
  delivery: TiakDelivery;
  currentUserId: string | null;
}) {
  const { locale, event, delivery, currentUserId } = params;
  const isFr = locale === "fr";
  const customerName = delivery.customer?.name ?? (isFr ? "Le client" : "The customer");
  const courierName = delivery.courier?.name ?? (isFr ? "Le coursier" : "The courier");
  const actorName = event.actor?.name ?? (event.actorId === delivery.customerId ? customerName : courierName);
  const ratingInfo = parseRatingNote(event.note);

  if (ratingInfo) {
    if (currentUserId === delivery.courierId) {
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
    if (currentUserId && currentUserId === delivery.courierId) {
      return isFr
        ? `${customerName} veut que vous livriez son colis. Acceptez-vous ?`
        : `${customerName} wants you to deliver the parcel. Do you accept?`;
    }
    return isFr
      ? `Votre demande est assignee a ${courierName}.`
      : `Your request has been assigned to ${courierName}.`;
  }

  if (event.status === "ACCEPTED") {
    return currentUserId === delivery.customerId
      ? isFr
        ? `${courierName} a accepte votre demande.`
        : `${courierName} accepted your request.`
      : isFr
        ? "Vous avez accepte la course."
        : "You accepted the delivery.";
  }

  if (event.status === "PICKED_UP") {
    return currentUserId === delivery.customerId
      ? isFr
        ? `${courierName} a recupere le colis.`
        : `${courierName} picked up the parcel.`
      : isFr
        ? "Colis recupere."
        : "Parcel picked up.";
  }

  if (event.status === "DELIVERED") {
    return currentUserId === delivery.customerId
      ? isFr
        ? `${courierName} a marque la livraison comme terminee. Merci de confirmer.`
        : `${courierName} marked delivery as completed. Please confirm receipt.`
      : isFr
        ? "Livraison marquee comme terminee."
        : "Delivery marked as completed.";
  }

  if (event.status === "COMPLETED") {
    return currentUserId === delivery.courierId
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

export default function TiakDeliveryDetails({
  locale,
  deliveryId,
  open,
  onClose,
  onDeliveryLoaded,
  isLoggedIn,
  currentUserId,
  currentUserRole,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [delivery, setDelivery] = useState<TiakDelivery | null>(null);
  const [events, setEvents] = useState<TiakDeliveryEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [messageNote, setMessageNote] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSuccess, setMessageSuccess] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSending, setRatingSending] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const onDeliveryLoadedRef = useRef(onDeliveryLoaded);

  useEffect(() => {
    onDeliveryLoadedRef.current = onDeliveryLoaded;
  }, [onDeliveryLoaded]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setEventsError(null);

      try {
        const detailResponse = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}`, {
          method: "GET",
          cache: "no-store",
        });

        const detailData = await detailResponse.json().catch(() => null);
        if (!detailResponse.ok || !detailData) {
          if (!cancelled) {
            setDelivery(null);
            setEvents([]);
          }
          return;
        }

        let resolvedDelivery = detailData as TiakDelivery;
        const isAdmin = currentUserRole === "ADMIN";
        const isOwner = Boolean(currentUserId && currentUserId === resolvedDelivery.customerId);
        const isAssignedCourier = Boolean(currentUserId && currentUserId === resolvedDelivery.courierId);
        const shouldIncludeAddress = isAdmin || isOwner || isAssignedCourier;

        if (shouldIncludeAddress) {
          const addressResponse = await fetch(
            `/api/tiak-tiak/deliveries/${deliveryId}?includeAddress=1`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

          const addressData = await addressResponse.json().catch(() => null);
          if (addressResponse.ok && addressData) {
            resolvedDelivery = addressData as TiakDelivery;
          }
        }

        if (!cancelled) {
          setDelivery(resolvedDelivery);
          onDeliveryLoadedRef.current(resolvedDelivery);
        }

        if (!isLoggedIn) {
          if (!cancelled) setEvents([]);
          return;
        }

        const eventsResponse = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, {
          method: "GET",
          cache: "no-store",
        });

        if (!eventsResponse.ok) {
          if (!cancelled) {
            setEvents([]);
            setEventsError(
              locale === "fr"
                ? "Timeline disponible uniquement pour les participants."
                : "Timeline available for participants only."
            );
          }
          return;
        }

        const eventsData = await eventsResponse.json().catch(() => []);
        if (!cancelled) {
          setEvents(Array.isArray(eventsData) ? (eventsData as TiakDeliveryEvent[]) : []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, currentUserRole, deliveryId, isLoggedIn, locale, open, refreshNonce]);

  const canSendMessage = Boolean(
    isLoggedIn &&
      delivery &&
      currentUserId &&
      (currentUserRole === "ADMIN" ||
        currentUserId === delivery.customerId ||
        currentUserId === delivery.courierId)
  );

  const hasSubmittedRating = useMemo(() => {
    if (!delivery || !currentUserId) return false;
    return events.some(
      (event) => event.actorId === currentUserId && parseRatingNote(event.note)
    );
  }, [currentUserId, delivery, events]);

  const canRateDelivery = Boolean(
    isLoggedIn &&
      delivery &&
      currentUserId === delivery.customerId &&
      delivery.status === "COMPLETED" &&
      !hasSubmittedRating
  );

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSendMessage) return;

    const trimmed = messageNote.trim();
    if (!trimmed) {
      setMessageError(locale === "fr" ? "Le message est vide." : "Message is empty.");
      return;
    }

    setMessageSending(true);
    setMessageError(null);
    setMessageSuccess(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessageError(
          toErrorMessage(
            data,
            locale === "fr" ? "Impossible d'envoyer le message." : "Unable to send message."
          )
        );
        return;
      }

      setMessageNote("");
      setMessageSuccess(locale === "fr" ? "Message envoye." : "Message sent.");
      setRefreshNonce((value) => value + 1);
    } catch {
      setMessageError(locale === "fr" ? "Impossible d'envoyer le message." : "Unable to send message.");
    } finally {
      setMessageSending(false);
    }
  }

  async function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRateDelivery) return;

    setRatingSending(true);
    setRatingError(null);
    setRatingSuccess(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: ratingValue,
          note: ratingComment.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRatingError(
          toErrorMessage(
            data,
            locale === "fr" ? "Impossible d'envoyer la note." : "Unable to submit rating."
          )
        );
        return;
      }

      setRatingComment("");
      setRatingSuccess(locale === "fr" ? "Note envoyee." : "Rating submitted.");
      setRefreshNonce((value) => value + 1);
    } catch {
      setRatingError(locale === "fr" ? "Impossible d'envoyer la note." : "Unable to submit rating.");
    } finally {
      setRatingSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            {locale === "fr" ? "Details livraison" : "Delivery details"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-2 py-1 text-xs text-zinc-200"
          >
            {locale === "fr" ? "Fermer" : "Close"}
          </button>
        </div>

        {loading && <p className="mt-4 text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}

        {!loading && delivery && (
          <div className="mt-4 space-y-4">
            <section className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 text-sm text-zinc-200">
              <p className="font-medium text-white">{delivery.pickupArea} -&gt; {delivery.dropoffArea}</p>
              <p className="mt-1 text-xs text-zinc-400">{locale === "fr" ? "Statut" : "Status"}: {delivery.status}</p>
              <p className="mt-1 text-xs text-zinc-400">{locale === "fr" ? "Cree le" : "Created"}: {formatDate(delivery.createdAt)}</p>
              {!delivery.canContact && (
                <p className="mt-1 text-xs text-zinc-500">{contactHintLabel(locale, delivery.paymentMethod, delivery.contactUnlockStatusHint)}</p>
              )}

              {delivery.pickupAddress ? (
                <p className="mt-3 text-xs text-zinc-300">
                  <span className="text-zinc-400">Pickup:</span> {delivery.pickupAddress}
                </p>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  {locale === "fr" ? "Adresse pickup masquee" : "Pickup address hidden"}
                </p>
              )}

              {delivery.dropoffAddress ? (
                <p className="mt-1 text-xs text-zinc-300">
                  <span className="text-zinc-400">Dropoff:</span> {delivery.dropoffAddress}
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">
                  {locale === "fr" ? "Adresse dropoff masquee" : "Dropoff address hidden"}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
              <h4 className="text-sm font-semibold text-white">Timeline</h4>
              {eventsError && <p className="mt-2 text-xs text-zinc-400">{eventsError}</p>}

              {!eventsError && events.length === 0 && (
                <p className="mt-2 text-xs text-zinc-400">
                  {locale === "fr" ? "Aucun event pour le moment." : "No events yet."}
                </p>
              )}

              <div className="mt-2 space-y-2">
                {events.map((event) => {
                  const rating = parseRatingNote(event.note);

                  return (
                    <article key={event.id} className="rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-xs text-zinc-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{event.status}</span>
                          {rating ? (
                            <span className="inline-flex items-center rounded-full border border-amber-300/45 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                              {locale === "fr" ? "Note" : "Rating"}: {rating.rating}/5
                            </span>
                          ) : null}
                        </div>
                        <span className="text-zinc-400">{formatDate(event.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-zinc-300">
                        {formatTiakEventNarrative({
                          locale,
                          event,
                          delivery,
                          currentUserId,
                        })}
                      </p>
                      {event.proofUrl && (
                        <a
                          href={event.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-emerald-300 underline"
                        >
                          {locale === "fr" ? "Voir preuve" : "Open proof"}
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            {canRateDelivery ? (
              <section className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
                <h4 className="text-sm font-semibold text-amber-100">
                  {locale === "fr" ? "Noter le coursier" : "Rate your courier"}
                </h4>
                <form className="mt-2 space-y-2" onSubmit={submitRating}>
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRatingValue(value)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${ratingValue === value ? "border-amber-200 bg-amber-200/20 text-amber-100" : "border-white/20 text-zinc-200 hover:border-amber-200/50"}`}
                        aria-label={`${value} / 5`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={ratingComment}
                    onChange={(event) => setRatingComment(event.target.value)}
                    rows={2}
                    maxLength={280}
                    placeholder={locale === "fr" ? "Commentaire optionnel" : "Optional comment"}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none transition focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/30"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={ratingSending}
                      className="rounded-lg border border-amber-300/45 bg-amber-300/15 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-60"
                    >
                      {ratingSending
                        ? locale === "fr"
                          ? "Envoi..."
                          : "Submitting..."
                        : locale === "fr"
                          ? "Envoyer la note"
                          : "Submit rating"}
                    </button>
                    {ratingSuccess ? <span className="text-xs text-emerald-300">{ratingSuccess}</span> : null}
                  </div>
                  {ratingError ? <p className="text-xs text-rose-300">{ratingError}</p> : null}
                </form>
              </section>
            ) : null}

            {canSendMessage ? (
              <section className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                <h4 className="text-sm font-semibold text-white">
                  {locale === "fr" ? "Message interne" : "Internal message"}
                </h4>
                <form className="mt-2 space-y-2" onSubmit={submitMessage}>
                  <textarea
                    value={messageNote}
                    onChange={(event) => setMessageNote(event.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder={locale === "fr" ? "Ecrire un message au participant..." : "Write a message to the participant..."}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/30"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={messageSending}
                      className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-60"
                    >
                      {messageSending
                        ? locale === "fr"
                          ? "Envoi..."
                          : "Sending..."
                        : locale === "fr"
                          ? "Envoyer"
                          : "Send"}
                    </button>
                    {messageSuccess ? <span className="text-xs text-emerald-300">{messageSuccess}</span> : null}
                  </div>
                  {messageError ? <p className="text-xs text-rose-300">{messageError}</p> : null}
                </form>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
