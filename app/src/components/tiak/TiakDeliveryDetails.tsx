"use client";

import { useEffect, useRef, useState } from "react";
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

function contactHintLabel(locale: string, paymentMethod: string | null) {
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
  }, [currentUserId, currentUserRole, deliveryId, isLoggedIn, locale, open]);

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
                <p className="mt-1 text-xs text-zinc-500">{contactHintLabel(locale, delivery.paymentMethod)}</p>
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
                {events.map((event) => (
                  <article key={event.id} className="rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-xs text-zinc-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{event.status}</span>
                      <span className="text-zinc-400">{formatDate(event.createdAt)}</span>
                    </div>
                    {event.note && <p className="mt-1 text-zinc-300">{event.note}</p>}
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
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
