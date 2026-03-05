"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TiakDelivery, TiakDeliveryEvent } from "@/components/tiak/types";

type ThreadState = {
  delivery: TiakDelivery | null;
  events: TiakDeliveryEvent[];
  loading: boolean;
};

type Props = {
  locale: string;
  meId: string;
  deliveryId: string | null;
  onThreadStateChange: (state: ThreadState) => void;
  onOpenOps: () => void;
  onMarkRead: () => void;
  onBackToList?: (() => void) | undefined;
  refreshNonce?: number;
};

const SYSTEM_NOTES = new Set([
  "Courier assigned",
  "Courier accepted assignment",
  "Courier declined assignment",
  "Assignment expired",
]);

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
  return { rating, comment };
}

function statusLabel(status: string, locale: string) {
  const isFr = locale === "fr";
  const fr: Record<string, string> = {
    REQUESTED: "Ouverte",
    ASSIGNED: "Assignee",
    ACCEPTED: "Acceptee",
    PICKED_UP: "En cours",
    DELIVERED: "Livree",
    COMPLETED: "Terminee",
    CANCELED: "Annulee",
    REJECTED: "Rejetee",
  };
  const en: Record<string, string> = {
    REQUESTED: "Open",
    ASSIGNED: "Assigned",
    ACCEPTED: "Accepted",
    PICKED_UP: "In progress",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    CANCELED: "Canceled",
    REJECTED: "Rejected",
  };
  return isFr ? (fr[status] ?? status) : (en[status] ?? status);
}

function eventNarrative(params: {
  locale: string;
  event: TiakDeliveryEvent;
  delivery: TiakDelivery;
  meId: string;
}) {
  const { locale, event, delivery, meId } = params;
  const isFr = locale === "fr";
  const customerName = delivery.customer?.name ?? (isFr ? "Client" : "Customer");
  const courierName = delivery.courier?.name ?? (isFr ? "Coursier" : "Courier");
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

  if (event.note && event.note.trim().length > 0 && !SYSTEM_NOTES.has(event.note.trim())) {
    return event.note;
  }

  if (event.status === "ASSIGNED") {
    return meId === delivery.courierId
      ? isFr
        ? `${customerName} veut que vous livriez son colis. Acceptez-vous ?`
        : `${customerName} wants you to deliver the parcel. Do you accept?`
      : isFr
        ? `Votre demande est assignee a ${courierName}.`
        : `Your request has been assigned to ${courierName}.`;
  }

  if (event.status === "ACCEPTED") {
    return isFr ? `${courierName} a accepte la course.` : `${courierName} accepted the delivery.`;
  }

  if (event.status === "PICKED_UP") {
    return isFr ? `${courierName} a recupere le colis.` : `${courierName} picked up the parcel.`;
  }

  if (event.status === "DELIVERED") {
    return isFr
      ? `${courierName} a marque la livraison comme terminee.`
      : `${courierName} marked delivery as completed.`;
  }

  if (event.status === "COMPLETED") {
    return meId === delivery.courierId
      ? isFr
        ? "Le client a confirme la livraison."
        : "The customer confirmed the delivery."
      : isFr
        ? "Livraison confirmee."
        : "Delivery confirmed.";
  }

  if (event.status === "REJECTED") {
    return isFr ? `${actorName} a refuse l'assignation.` : `${actorName} declined the assignment.`;
  }

  if (event.status === "CANCELED") {
    return isFr ? `${actorName} a annule la course.` : `${actorName} canceled the delivery.`;
  }

  return event.status;
}

function dayLabel(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function timeLabel(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPanel({
  locale,
  meId,
  deliveryId,
  onThreadStateChange,
  onOpenOps,
  onMarkRead,
  onBackToList,
  refreshNonce = 0,
}: Props) {
  const isFr = locale === "fr";
  const [delivery, setDelivery] = useState<TiakDelivery | null>(null);
  const [events, setEvents] = useState<TiakDeliveryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [lastRenderedEventId, setLastRenderedEventId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);

  const loadThread = useCallback(
    async (silent = false) => {
      if (!deliveryId) {
        setDelivery(null);
        setEvents([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

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

        const nextEvents = Array.isArray(eventsData) ? (eventsData as TiakDeliveryEvent[]) : [];

        setDelivery(deliveryData as TiakDelivery);
        setEvents(nextEvents);
        setError(null);

        const newestId = nextEvents[nextEvents.length - 1]?.id ?? null;
        if (newestId && newestId !== lastRenderedEventId) {
          setLastRenderedEventId(newestId);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : isFr ? "Erreur de chargement." : "Loading error.");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [deliveryId, isFr, lastRenderedEventId]
  );

  useEffect(() => {
    void loadThread(false);
  }, [loadThread, refreshNonce]);

  useEffect(() => {
    if (!deliveryId) return;

    const interval = setInterval(() => {
      void loadThread(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [deliveryId, loadThread]);

  useEffect(() => {
    onThreadStateChange({ delivery, events, loading });
  }, [delivery, events, loading, onThreadStateChange]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (wasNearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
      setShowJumpButton(false);
      return;
    }

    setShowJumpButton(true);
  }, [events.length]);

  const groupedEvents = useMemo(() => {
    return events.map((event, index) => {
      const previous = events[index - 1] ?? null;
      const showDateSeparator = !previous || dayLabel(previous.createdAt, locale) !== dayLabel(event.createdAt, locale);
      const groupedWithPrevious =
        Boolean(previous) &&
        previous.actorId === event.actorId &&
        !showDateSeparator;
      return { event, showDateSeparator, groupedWithPrevious, isLast: index === events.length - 1 };
    });
  }, [events, locale]);

  const onScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceToBottom < 120;
    wasNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowJumpButton(false);
    }
  };

  const jumpToBottom = () => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    wasNearBottomRef.current = true;
    setShowJumpButton(false);
  };

  const copyId = async () => {
    if (!deliveryId) return;
    try {
      await navigator.clipboard.writeText(deliveryId);
    } catch {
      return;
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deliveryId) return;

    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    setSendError(null);

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
      wasNearBottomRef.current = true;
      await loadThread(true);
    } catch (sendFailure) {
      setSendError(sendFailure instanceof Error ? sendFailure.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setSending(false);
    }
  };

  if (!deliveryId) {
    return (
      <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4">
        <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-white/15 bg-zinc-950/60 text-sm text-zinc-500">
          {isFr ? "Selectionne une conversation." : "Select a conversation."}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
      <header className="sticky top-0 z-10 rounded-xl border border-white/10 bg-zinc-950/95 px-3 py-2 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {delivery ? `${delivery.pickupArea} -> ${delivery.dropoffArea}` : "..."}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {delivery ? statusLabel(delivery.status, locale) : "-"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onBackToList ? (
              <button
                type="button"
                onClick={onBackToList}
                className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-200"
              >
                {isFr ? "Retour" : "Back"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onMarkRead}
              className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-200 transition hover:border-white/35"
            >
              {isFr ? "Marquer lu" : "Mark read"}
            </button>
            <button
              type="button"
              onClick={() => void copyId()}
              className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-200 transition hover:border-white/35"
            >
              ID
            </button>
            <button
              type="button"
              onClick={onOpenOps}
              className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300/60 xl:hidden"
            >
              {isFr ? "Ops" : "Ops"}
            </button>
          </div>
        </div>
      </header>

      <div className="relative mt-3">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-[58vh] overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/70 p-3"
        >
          {loading ? (
            <div className="space-y-2">
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
            </div>
          ) : error ? (
            <p className="text-xs text-rose-300">{error}</p>
          ) : groupedEvents.length === 0 ? (
            <p className="text-xs text-zinc-500">{isFr ? "Aucun message pour le moment." : "No messages yet."}</p>
          ) : (
            <div className="space-y-2">
              {groupedEvents.map(({ event, showDateSeparator, groupedWithPrevious, isLast }) => {
                const mine = event.actorId === meId;
                const ratingInfo = parseRatingNote(event.note);

                return (
                  <div key={event.id} className="group">
                    {showDateSeparator ? (
                      <div className="my-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{dayLabel(event.createdAt, locale)}</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                    ) : null}

                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <article
                        className={`max-w-[85%] rounded-2xl border px-3 py-2 text-xs transition-opacity ${
                          mine
                            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                            : "border-white/10 bg-zinc-900 text-zinc-100"
                        } ${isLast ? "ring-1 ring-emerald-300/10" : ""}`}
                      >
                        {!groupedWithPrevious ? (
                          <p className="text-[11px] text-zinc-400">{event.actor?.name || (isFr ? "Utilisateur" : "User")}</p>
                        ) : null}

                        {ratingInfo ? (
                          <span className="mt-1 inline-flex rounded-full border border-amber-300/45 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                            {isFr ? "Note" : "Rating"}: {ratingInfo.rating}/5
                          </span>
                        ) : null}

                        <p className="mt-1 whitespace-pre-wrap break-words">
                          {delivery ? eventNarrative({ locale, event, delivery, meId }) : event.note || event.status}
                        </p>

                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-500 opacity-0 transition group-hover:opacity-100">
                          <span>{timeLabel(event.createdAt, locale)}</span>
                        </div>
                      </article>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showJumpButton ? (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-[11px] font-semibold text-emerald-100"
          >
            {isFr ? "Nouveaux messages" : "New messages"}
          </button>
        ) : null}
      </div>

      <form onSubmit={sendMessage} className="mt-3 rounded-xl border border-white/10 bg-zinc-950/65 p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (draft.trim().length > 0 && !sending) {
                  const form = event.currentTarget.form;
                  if (form) {
                    form.requestSubmit();
                  }
                }
              }
            }}
            rows={2}
            placeholder={isFr ? "Ecris ton message..." : "Write your message..."}
            className="min-h-[46px] w-full resize-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/25"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={isFr ? "Envoyer" : "Send"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M22 2 11 13" />
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
        {sendError ? <p className="mt-1 text-xs text-rose-300">{sendError}</p> : null}
      </form>
    </section>
  );
}
