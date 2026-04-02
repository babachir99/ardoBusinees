"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MessagePresenceSummary } from "@/lib/messages/presence";
import type { TiakDelivery, TiakDeliveryEvent } from "@/components/tiak/types";
import useAdaptivePolling from "@/components/messages/useAdaptivePolling";

type ThreadState = {
  delivery: TiakDelivery | null;
  events: TiakDeliveryEvent[];
  loading: boolean;
};

type Counterpart = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

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

function formatPresenceLabel(
  presence: MessagePresenceSummary | null,
  locale: string
) {
  const isFr = locale === "fr";
  if (!presence?.lastSeenAt) {
    return isFr ? "Derniere connexion inconnue" : "Last seen unavailable";
  }

  if (presence.online) {
    return isFr ? "En ligne" : "Online";
  }

  return isFr
    ? `Vu ${new Date(presence.lastSeenAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : `Last seen ${new Date(presence.lastSeenAt).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
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

  if (!event.note && event.proofUrl) {
    return isFr ? "Piece jointe partagee." : "Attachment shared.";
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

type LoadMode = "replace" | "prepend" | "sync";

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
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counterpart, setCounterpart] = useState<Counterpart>(null);
  const [presence, setPresence] = useState<MessagePresenceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasNearBottomRef = useRef(true);
  const preserveScrollRef = useRef<{ top: number; height: number } | null>(null);
  const eventsRef = useRef<TiakDeliveryEvent[]>([]);
  const pollIntervalMs = useAdaptivePolling({ active: Boolean(deliveryId) });

  const loadThread = useCallback(
    async ({
      silent = false,
      before = null,
      mode = "replace",
    }: {
      silent?: boolean;
      before?: string | null;
      mode?: LoadMode;
    }) => {
      if (!deliveryId) {
        setDelivery(null);
        setEvents([]);
        setCounterpart(null);
        setPresence(null);
        setHasMore(false);
        setNextCursor(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (!silent && mode !== "prepend") {
        setLoading(true);
      }
      if (mode === "prepend") {
        setLoadingOlder(true);
      }

      try {
        const deliveryRes = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}?includeAddress=1`, {
          cache: "no-store",
        });
        const parsedDelivery = await deliveryRes.json().catch(() => null);
        if (!deliveryRes.ok || !parsedDelivery) {
          throw new Error(isFr ? "Conversation indisponible." : "Conversation unavailable.");
        }
        const deliveryData = parsedDelivery as TiakDelivery;
        setDelivery(deliveryData);

        const search = new URLSearchParams();
        search.set("take", "24");
        if (before) search.set("before", before);

        const eventsRes = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events?${search.toString()}`, {
          cache: "no-store",
        });
        const eventsData = await eventsRes.json().catch(() => null);
        if (!eventsRes.ok || !eventsData || typeof eventsData !== "object") {
          throw new Error(isFr ? "Timeline indisponible." : "Timeline unavailable.");
        }

        const nextEvents = Array.isArray((eventsData as { events?: unknown }).events)
          ? ((eventsData as { events: TiakDeliveryEvent[] }).events ?? [])
          : [];
        const nextPresence =
          (eventsData as { presence?: unknown }).presence &&
          typeof (eventsData as { presence?: unknown }).presence === "object"
            ? ((eventsData as { presence: MessagePresenceSummary }).presence ?? null)
            : null;
        const nextCounterpart =
          (eventsData as { counterpart?: unknown }).counterpart &&
          typeof (eventsData as { counterpart?: unknown }).counterpart === "object"
            ? ((eventsData as { counterpart: Counterpart }).counterpart ?? null)
            : null;

        setCounterpart(nextCounterpart);
        setPresence(nextPresence);

        if (mode !== "sync" || eventsRef.current.length === 0) {
          setHasMore(Boolean((eventsData as { pagination?: { hasMore?: boolean } }).pagination?.hasMore));
          setNextCursor(
            typeof (eventsData as { pagination?: { nextCursor?: unknown } }).pagination?.nextCursor === "string"
              ? ((eventsData as { pagination: { nextCursor: string } }).pagination.nextCursor ?? null)
              : null
          );
        }

        if (mode === "prepend") {
          setEvents((current) => {
            const seen = new Set(current.map((event) => event.id));
            return [...nextEvents.filter((event) => !seen.has(event.id)), ...current];
          });
        } else if (mode === "sync") {
          setEvents((current) => {
            const merged = new Map(current.map((event) => [event.id, event]));
            for (const event of nextEvents) {
              merged.set(event.id, event);
            }
            return [...merged.values()].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        } else {
          setEvents(nextEvents);
        }

        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : isFr ? "Erreur de chargement." : "Loading error.");
      } finally {
        if (!silent && mode !== "prepend") {
          setLoading(false);
        }
        if (mode === "prepend") {
          setLoadingOlder(false);
        }
      }
    },
    [deliveryId, isFr]
  );

  useEffect(() => {
    void loadThread({ silent: false, mode: "replace" });
  }, [loadThread, refreshNonce]);

  useEffect(() => {
    if (!deliveryId || pollIntervalMs === null) return;

    const interval = window.setInterval(() => {
      void loadThread({ silent: true, mode: "sync" });
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [deliveryId, loadThread, pollIntervalMs]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    onThreadStateChange({ delivery, events, loading });
  }, [delivery, events, loading, onThreadStateChange]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (preserveScrollRef.current) {
      const { top, height } = preserveScrollRef.current;
      container.scrollTop = container.scrollHeight - height + top;
      preserveScrollRef.current = null;
      return;
    }

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

  const loadOlder = async () => {
    if (!hasMore || !nextCursor || loadingOlder) return;

    const container = scrollRef.current;
    if (container) {
      preserveScrollRef.current = {
        top: container.scrollTop,
        height: container.scrollHeight,
      };
    }

    await loadThread({ silent: true, before: nextCursor, mode: "prepend" });
  };

  const copyId = async () => {
    if (!deliveryId) return;
    try {
      await navigator.clipboard.writeText(deliveryId);
    } catch {
      return;
    }
  };

  const uploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
    setAttachmentError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== "string") {
        throw new Error(toErrorMessage(data, isFr ? "Upload impossible." : "Upload failed."));
      }
      setAttachmentUrl(data.url);
    } catch (uploadFailure) {
      setAttachmentError(uploadFailure instanceof Error ? uploadFailure.message : isFr ? "Upload impossible." : "Upload failed.");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deliveryId) return;

    const message = draft.trim();
    if ((!message && !attachmentUrl) || sending) return;

    setSending(true);
    setSendError(null);
    setAttachmentError(null);

    try {
      const response = await fetch(`/api/tiak-tiak/deliveries/${deliveryId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: message, proofUrl: attachmentUrl }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          toErrorMessage(data, isFr ? "Impossible d'envoyer le message." : "Unable to send message.")
        );
      }

      setDraft("");
      setAttachmentUrl(null);
      wasNearBottomRef.current = true;
      await loadThread({ silent: true, mode: "sync" });
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
    <section className="flex h-[min(72vh,calc(100dvh-9rem))] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/55 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.25)] sm:p-4 lg:min-h-[560px]">
      <header className="sticky top-0 z-10 shrink-0 rounded-t-xl border-b border-neutral-800 bg-neutral-950/80 px-3 py-2 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {delivery ? `${delivery.pickupArea} -> ${delivery.dropoffArea}` : "..."}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <span>{delivery ? statusLabel(delivery.status, locale) : "-"}</span>
              <span className={`inline-flex h-2 w-2 rounded-full ${presence?.online ? "bg-emerald-400" : "bg-zinc-600"}`} aria-hidden />
              <span className="truncate">{counterpart?.name || counterpart?.email || (isFr ? "Contact" : "Contact")}</span>
              <span className="truncate text-zinc-500">{formatPresenceLabel(presence, locale)}</span>
            </div>
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

      <div className="relative mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/70">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
        >
          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/30 disabled:opacity-60"
            >
              {loadingOlder
                ? isFr
                  ? "Chargement..."
                  : "Loading..."
                : isFr
                  ? "Charger des messages plus anciens"
                  : "Load older messages"}
            </button>
          ) : null}

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
                        className={`max-w-[85%] rounded-2xl border px-3 py-2 text-xs transition-opacity motion-safe:animate-[fadeIn_0.2s_ease] ${
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
                        {event.proofUrl ? (
                          <a
                            href={event.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-[11px] text-emerald-300 underline"
                          >
                            {isFr ? "Voir la piece jointe" : "Open attachment"}
                          </a>
                        ) : null}

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
            className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-[11px] font-semibold text-emerald-100"
          >
            {isFr ? "Nouveaux messages v" : "New messages v"}
          </button>
        ) : null}

        <form onSubmit={sendMessage} className="sticky bottom-0 z-10 shrink-0 border-t border-neutral-800 bg-neutral-950/80 p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if ((draft.trim().length > 0 || attachmentUrl) && !sending) {
                    const form = event.currentTarget.form;
                    if (form) {
                      form.requestSubmit();
                    }
                  }
                }
              }}
              rows={2}
              placeholder={isFr ? "Ecris ton message..." : "Write your message..."}
              className="min-h-[46px] flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/25"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void uploadAttachment(file);
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment || sending}
                aria-label={isFr ? "Joindre un fichier" : "Attach a file"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800/70 bg-neutral-900/40 text-neutral-300 transition-all duration-200 ease-out hover:border-emerald-400/20 hover:bg-neutral-800/40 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="sr-only">{isFr ? "Joindre" : "Attach"}</span>
                {uploadingAttachment ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 animate-spin">
                    <path d="M12 3a9 9 0 1 0 9 9" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l8.49-8.49a4 4 0 1 1 5.66 5.66l-8.5 8.5a2 2 0 0 1-2.82-2.83l7.78-7.78" />
                  </svg>
                )}
              </button>
              <button
                type="submit"
                disabled={sending || (draft.trim().length === 0 && !attachmentUrl)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={isFr ? "Envoyer" : "Send"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M22 2 11 13" />
                  <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                </svg>
              </button>
            </div>
          </div>
          {attachmentUrl ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="truncate text-emerald-300 underline">
                {isFr ? "Piece jointe prete" : "Attachment ready"}
              </a>
              <button
                type="button"
                onClick={() => setAttachmentUrl(null)}
                className="rounded-full border border-white/20 px-2 py-0.5 text-[10px]"
              >
                {isFr ? "Retirer" : "Remove"}
              </button>
            </div>
          ) : null}
          {attachmentError ? <p className="mt-1 text-xs text-rose-300">{attachmentError}</p> : null}
          {sendError ? <p className="mt-1 text-xs text-rose-300">{sendError}</p> : null}
        </form>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
