"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type TiakDelivery, type TiakDeliveryEvent, type TiakLiveLocation } from "@/components/tiak/types";

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

function buildOpenStreetMapEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.01;
  const left = Math.max(-180, longitude - delta);
  const right = Math.min(180, longitude + delta);
  const top = Math.min(90, latitude + delta);
  const bottom = Math.max(-90, latitude - delta);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function buildOpenStreetMapHref(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}

const VIEWER_LOCATION_REFRESH_MS = 8000;
const SHARE_LOCATION_REFRESH_MS = 12000;
const STALE_LOCATION_MS = 60000;
const VERY_STALE_LOCATION_MS = 180000;

function formatRelativeTime(locale: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  const diffMs = Date.now() - parsed.getTime();
  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));

  if (diffSeconds < 5) {
    return locale === "fr" ? "a l'instant" : "just now";
  }

  if (diffSeconds < 60) {
    return locale === "fr" ? `il y a ${diffSeconds}s` : `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return locale === "fr" ? `il y a ${diffMinutes} min` : `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return locale === "fr" ? `il y a ${diffHours} h` : `${diffHours}h ago`;
}

function formatSpeed(locale: string, speed: number | null) {
  if (speed === null || Number.isNaN(speed) || speed <= 0) {
    return locale === "fr" ? "A l'arret" : "Stopped";
  }

  const kmh = Math.round(speed * 3.6);
  return `${kmh} km/h`;
}

function formatHeading(locale: string, heading: number | null) {
  if (heading === null || Number.isNaN(heading)) {
    return locale === "fr" ? "Cap indisponible" : "Heading unavailable";
  }

  const normalized = ((heading % 360) + 360) % 360;
  const directions = locale === "fr"
    ? ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"]
    : ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
  const index = Math.round(normalized / 45) % directions.length;
  return `${directions[index]} - ${Math.round(normalized)}deg`;
}

function formatDistance(locale: string, meters: number | null) {
  if (meters === null || !Number.isFinite(meters) || meters <= 0) {
    return locale === "fr" ? "Distance indisponible" : "Distance unavailable";
  }

  if (meters < 1000) {
    return `${meters} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(locale: string, seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return locale === "fr" ? "ETA indisponible" : "ETA unavailable";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return locale === "fr" ? `${minutes} min` : `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return locale === "fr"
    ? `${hours} h ${remainingMinutes} min`
    : `${hours}h ${remainingMinutes} min`;
}

function getRouteSourceLabel(
  locale: string,
  source: "osrm" | "geodesic" | "none" | undefined
) {
  if (source === "osrm") {
    return locale === "fr" ? "ETA routiere" : "Route ETA";
  }

  if (source === "geodesic") {
    return locale === "fr" ? "ETA estimee" : "Estimated ETA";
  }

  return locale === "fr" ? "ETA indisponible" : "ETA unavailable";
}

function getLocationSignalTone(locale: string, ageMs: number | null) {
  if (ageMs === null) {
    return {
      label: locale === "fr" ? "En attente" : "Waiting",
      hint: locale === "fr" ? "Aucune position partagee pour le moment." : "No shared location yet.",
      badgeClass: "border-white/15 bg-white/5 text-zinc-200",
    };
  }

  if (ageMs <= STALE_LOCATION_MS) {
    return {
      label: locale === "fr" ? "Live" : "Live",
      hint: locale === "fr" ? "Signal recent et exploitable." : "Fresh signal available.",
      badgeClass: "border-emerald-300/40 bg-emerald-300/15 text-emerald-100",
    };
  }

  if (ageMs <= VERY_STALE_LOCATION_MS) {
    return {
      label: locale === "fr" ? "Signal faible" : "Weak signal",
      hint: locale === "fr" ? "Derniere position un peu ancienne." : "Latest position is getting older.",
      badgeClass: "border-amber-300/40 bg-amber-300/15 text-amber-100",
    };
  }

  return {
    label: locale === "fr" ? "Hors ligne" : "Offline",
    hint: locale === "fr" ? "Le suivi semble interrompu." : "Tracking looks paused.",
    badgeClass: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  };
}

function getEtaHint(
  locale: string,
  status: TiakDelivery["status"] | null,
  speed: number | null,
  ageMs: number | null
) {
  if (!status || ageMs === null || ageMs > VERY_STALE_LOCATION_MS) {
    return {
      label: locale === "fr" ? "Indisponible" : "Unavailable",
      hint: locale === "fr" ? "ETA indicative en attente d'un signal fiable." : "Indicative ETA is waiting for a fresh signal.",
    };
  }

  if (status === "ACCEPTED") {
    return {
      label: locale === "fr" ? "Approche pickup" : "Approaching pickup",
      hint: locale === "fr" ? "Le coursier se rapproche du point de collecte." : "Courier is moving toward pickup.",
    };
  }

  if (status === "PICKED_UP") {
    const kmh = speed !== null && speed > 0 ? speed * 3.6 : 0;
    if (kmh >= 30) {
      return {
        label: locale === "fr" ? "Tres proche" : "Very close",
        hint: locale === "fr" ? "Fenetre ETA courte si le rythme reste stable." : "Short ETA window if pace remains stable.",
      };
    }
    if (kmh >= 15) {
      return {
        label: locale === "fr" ? "En route" : "On the way",
        hint: locale === "fr" ? "Progression reguliere vers la destination." : "Steady progress toward destination.",
      };
    }
    if (kmh > 0) {
      return {
        label: locale === "fr" ? "Progression lente" : "Slow progress",
        hint: locale === "fr" ? "ETA plus large tant que la vitesse reste basse." : "Wider ETA window while speed stays low.",
      };
    }
    return {
      label: locale === "fr" ? "Pause courte" : "Short stop",
      hint: locale === "fr" ? "Le coursier semble momentanement a l'arret." : "Courier appears briefly stopped.",
    };
  }

  if (status === "DELIVERED") {
    return {
      label: locale === "fr" ? "Livre" : "Delivered",
      hint: locale === "fr" ? "En attente de confirmation du client." : "Waiting for customer confirmation.",
    };
  }

  if (status === "COMPLETED") {
    return {
      label: locale === "fr" ? "Termine" : "Completed",
      hint: locale === "fr" ? "La course est finalisee." : "Delivery is finalized.",
    };
  }

  return {
    label: locale === "fr" ? "Suivi actif" : "Tracking active",
    hint: locale === "fr" ? "Le suivi est actif sur cette course." : "Tracking is active for this delivery.",
  };
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
  const [liveLocation, setLiveLocation] = useState<TiakLiveLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);
  const [locationRefreshNonce, setLocationRefreshNonce] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const onDeliveryLoadedRef = useRef(onDeliveryLoaded);
  const locationIntervalRef = useRef<number | null>(null);

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

  const isAssignedCourier = Boolean(
    delivery &&
      currentUserId &&
      currentUserId === delivery.courierId
  );

  const canShareLocation = Boolean(
    open &&
      delivery &&
      isAssignedCourier &&
      ["ACCEPTED", "PICKED_UP", "DELIVERED"].includes(delivery.status)
  );

  const canViewLocation = Boolean(
    open &&
      delivery &&
      currentUserId &&
      (currentUserRole === "ADMIN" ||
        currentUserId === delivery.customerId ||
        currentUserId === delivery.courierId)
  );

  const locationAgeMs = useMemo(() => {
    if (!liveLocation) return null;
    const parsed = new Date(liveLocation.createdAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, Date.now() - parsed.getTime());
  }, [liveLocation]);

  const signalTone = useMemo(
    () => getLocationSignalTone(locale, locationAgeMs),
    [locale, locationAgeMs]
  );

  const etaHint = useMemo(
    () => getEtaHint(locale, delivery?.status ?? null, liveLocation?.speed ?? null, locationAgeMs),
    [delivery?.status, liveLocation?.speed, locale, locationAgeMs]
  );

  const speedLabel = useMemo(
    () => formatSpeed(locale, liveLocation?.speed ?? null),
    [liveLocation?.speed, locale]
  );

  const headingLabel = useMemo(
    () => formatHeading(locale, liveLocation?.heading ?? null),
    [liveLocation?.heading, locale]
  );

  const routeEtaLabel = useMemo(
    () => formatDuration(locale, liveLocation?.route?.etaSeconds ?? null),
    [liveLocation?.route?.etaSeconds, locale]
  );

  const routeDistanceLabel = useMemo(
    () => formatDistance(locale, liveLocation?.route?.distanceMeters ?? null),
    [liveLocation?.route?.distanceMeters, locale]
  );

  const routeSourceLabel = useMemo(
    () => getRouteSourceLabel(locale, liveLocation?.route?.source),
    [liveLocation?.route?.source, locale]
  );

  useEffect(() => {
    if (canShareLocation) return;
    setSharingLocation(false);
  }, [canShareLocation]);

  useEffect(() => {
    if (!open || !canViewLocation) {
      setLiveLocation(null);
      setLocationError(null);
      setLocationLoading(false);
      return;
    }

    let cancelled = false;

    const loadLocation = async (silent = false) => {
      if (!silent) setLocationLoading(true);
      if (!silent) setLocationError(null);

      try {
        const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/location`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok) {
          if (!silent) {
            setLocationError(
              toErrorMessage(
                data,
                locale === "fr" ? "Position indisponible." : "Location unavailable."
              )
            );
          }
          return;
        }

        setLiveLocation(data && typeof data === "object" ? (data as TiakLiveLocation | null) : null);
      } catch {
        if (!silent) {
          setLocationError(locale === "fr" ? "Position indisponible." : "Location unavailable.");
        }
      } finally {
        if (!cancelled && !silent) setLocationLoading(false);
      }
    };

    void loadLocation(false);

    const shouldPoll =
      delivery &&
      ["ACCEPTED", "PICKED_UP", "DELIVERED"].includes(delivery.status);

    const interval = shouldPoll
      ? window.setInterval(() => {
          void loadLocation(true);
        }, VIEWER_LOCATION_REFRESH_MS)
      : null;

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [canViewLocation, delivery, deliveryId, locale, locationRefreshNonce, open]);

  useEffect(() => {
    if (!sharingLocation || !canShareLocation || typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setLocationError(
        locale === "fr"
          ? "La geolocalisation n'est pas disponible sur cet appareil."
          : "Geolocation is not available on this device."
      );
      setSharingLocation(false);
      return;
    }

    let cancelled = false;

    const publishPosition = async () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (cancelled) return;

          try {
            const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/location`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading:
                  position.coords.heading === null || Number.isNaN(position.coords.heading)
                    ? undefined
                    : position.coords.heading,
                speed:
                  position.coords.speed === null || Number.isNaN(position.coords.speed)
                    ? undefined
                    : position.coords.speed,
              }),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
              setLocationError(
                toErrorMessage(
                  data,
                  locale === "fr"
                    ? "Partage de position impossible."
                    : "Unable to share your location."
                )
              );
              return;
            }

            setLiveLocation(data as TiakLiveLocation);
            setSharingMessage(
              locale === "fr"
                ? "Position partagee en direct."
                : "Live location shared."
            );
            setLocationError(null);
          } catch {
            if (!cancelled) {
              setLocationError(
                locale === "fr"
                  ? "Partage de position impossible."
                  : "Unable to share your location."
              );
            }
          }
        },
        (error) => {
          if (cancelled) return;

          const message =
            error.code === error.PERMISSION_DENIED
              ? locale === "fr"
                ? "Autorise la geolocalisation pour partager ta position."
                : "Allow geolocation to share your position."
              : locale === "fr"
                ? "Impossible de recuperer votre position."
                : "Unable to read your location.";
          setLocationError(message);
          setSharingLocation(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 10000,
        }
      );
    };

    void publishPosition();
    locationIntervalRef.current = window.setInterval(() => {
      void publishPosition();
    }, SHARE_LOCATION_REFRESH_MS);

    return () => {
      cancelled = true;
      if (locationIntervalRef.current !== null) {
        window.clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [canShareLocation, deliveryId, locale, sharingLocation]);

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

            {(canViewLocation || canShareLocation) ? (
              <section className="rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_45%),rgba(6,95,70,0.08)] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">
                        {locale === "fr" ? "Suivi sur carte" : "Live map tracking"}
                      </h4>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${signalTone.badgeClass}`}>
                        {signalTone.label}
                      </span>
                      {liveLocation ? (
                        <span className="rounded-full border border-white/10 bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-300">
                          {locale === "fr" ? "Maj" : "Updated"} {formatRelativeTime(locale, liveLocation.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-zinc-400">{signalTone.hint}</p>
                    <p className="text-[11px] text-zinc-500">
                      {locale === "fr"
                        ? "Refresh auto toutes les 8s pour le client, partage coursier toutes les 12s."
                        : "Auto-refresh every 8s for viewers, courier sharing every 12s."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSharingMessage(null);
                        setLocationError(null);
                        setLocationRefreshNonce((value) => value + 1);
                      }}
                      className="rounded-full border border-white/15 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-emerald-300/50 hover:text-white"
                    >
                      {locationLoading
                        ? locale === "fr"
                          ? "Actualisation..."
                          : "Refreshing..."
                        : locale === "fr"
                          ? "Actualiser"
                          : "Refresh"}
                    </button>

                    {canShareLocation ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSharingMessage(null);
                          setLocationError(null);
                          setSharingLocation((value) => !value);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          sharingLocation
                            ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-100"
                            : "border-white/20 text-white hover:border-emerald-300/50"
                        }`}
                      >
                        {sharingLocation
                          ? locale === "fr"
                            ? "Pause position"
                            : "Pause location"
                          : locale === "fr"
                            ? "Partager ma position"
                            : "Share my location"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {locationError ? (
                  <p className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-200">
                    {locationError}
                  </p>
                ) : null}

                {sharingMessage ? (
                  <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200">
                    {sharingMessage}
                  </p>
                ) : null}

                {liveLocation ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                        <span className="text-zinc-500">{routeSourceLabel}</span>
                        <p className="mt-1 text-sm font-semibold text-white">{routeEtaLabel}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {liveLocation.route?.waypointLabel
                            ? `${liveLocation.route.waypointType === "PICKUP"
                                ? locale === "fr"
                                  ? "Vers pickup"
                                  : "To pickup"
                                : locale === "fr"
                                  ? "Vers livraison"
                                  : "To dropoff"}: ${liveLocation.route.waypointLabel}`
                            : etaHint.hint}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                        <span className="text-zinc-500">{locale === "fr" ? "Distance restante" : "Remaining distance"}</span>
                        <p className="mt-1 text-sm font-semibold text-white">{routeDistanceLabel}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {etaHint.label}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                        <span className="text-zinc-500">{locale === "fr" ? "Vitesse" : "Speed"}</span>
                        <p className="mt-1 text-sm font-semibold text-white">{speedLabel}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {locale === "fr" ? "Basee sur le dernier signal partage." : "Based on the latest shared ping."}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                        <span className="text-zinc-500">{locale === "fr" ? "Direction" : "Heading"}</span>
                        <p className="mt-1 text-sm font-semibold text-white">{headingLabel}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {locale === "fr" ? "Cap du dernier mouvement mesure." : "Heading from the last measured movement."}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                        <span className="text-zinc-500">{locale === "fr" ? "Precision" : "Accuracy"}</span>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {liveLocation.accuracy !== null ? `${Math.round(liveLocation.accuracy)} m` : "-"}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {locale === "fr" ? "Qualite du point GPS courant." : "Quality of the current GPS sample."}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-zinc-950/90 px-4 py-3 text-xs text-zinc-300">
                        <div>
                          <p className="font-semibold text-white">
                            {delivery.pickupArea} -&gt; {delivery.dropoffArea}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {locale === "fr"
                              ? `Signal recu ${formatRelativeTime(locale, liveLocation.createdAt)}`
                              : `Signal received ${formatRelativeTime(locale, liveLocation.createdAt)}`}
                          </p>
                        </div>
                        <a
                          href={buildOpenStreetMapHref(liveLocation.latitude, liveLocation.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 font-semibold text-emerald-200 transition hover:border-emerald-300/60"
                        >
                          {locale === "fr" ? "Ouvrir la carte" : "Open map"}
                        </a>
                      </div>

                      <iframe
                        title={locale === "fr" ? "Carte de suivi Tiak" : "Tiak tracking map"}
                        src={buildOpenStreetMapEmbedUrl(liveLocation.latitude, liveLocation.longitude)}
                        className="h-64 w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 px-4 py-5 text-xs text-zinc-400">
                    {locationLoading
                      ? locale === "fr"
                        ? "Chargement du signal GPS..."
                        : "Loading GPS signal..."
                      : locale === "fr"
                        ? "Le suivi s'activera des que le coursier partagera sa position."
                        : "Tracking will appear as soon as the courier starts sharing location."}
                  </div>
                )}
              </section>
            ) : null}

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
