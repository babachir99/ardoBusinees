
"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { MessagePresenceSummary } from "@/lib/messages/presence";
import useAdaptivePolling from "@/components/messages/useAdaptivePolling";

type GpEvent = {
  id: string;
  status: string;
  createdAt: string;
  note?: string | null;
  proofUrl?: string | null;
  proofType?: string | null;
  actorId?: string;
  actor?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

type GpShipment = {
  id: string;
  code: string;
  status: string;
  fromCity: string | null;
  toCity: string | null;
  weightKg: number | null;
  senderId: string | null;
  receiverId: string | null;
  transporterId: string | null;
  sender?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null;
  receiver?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null;
  transporter?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null;
};

type Counterpart = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

type PendingAttachment = {
  url: string;
  type: string | null;
};

type Props = {
  locale: string;
  meId: string;
  meRole: string | null | undefined;
  shipmentId: string;
  onBackToList?: (() => void) | undefined;
};

function toErrorMessage(data: unknown, fallback: string) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof record?.error === "string") return record.error;
  if (typeof record?.message === "string") return record.message;
  return fallback;
}

function formatPresenceLabel(presence: MessagePresenceSummary | null, locale: string) {
  const isFr = locale === "fr";
  if (!presence?.lastSeenAt) return isFr ? "Derniere connexion inconnue" : "Last seen unavailable";
  if (presence.online) return isFr ? "En ligne" : "Online";
  return isFr
    ? `Vu ${new Date(presence.lastSeenAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
    : `Last seen ${new Date(presence.lastSeenAt).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
}

function formatStatus(status: string, locale: string) {
  const isFr = locale === "fr";
  const fr: Record<string, string> = {
    DROPPED_OFF: "Depose",
    PICKED_UP: "Recupere",
    BOARDED: "Embarque",
    ARRIVED: "Arrive",
    DELIVERED: "Livre",
  };
  const en: Record<string, string> = {
    DROPPED_OFF: "Dropped off",
    PICKED_UP: "Picked up",
    BOARDED: "Boarded",
    ARRIVED: "Arrived",
    DELIVERED: "Delivered",
  };
  return isFr ? (fr[status] ?? status) : (en[status] ?? status);
}

function eventNarrative(event: GpEvent, locale: string) {
  const isFr = locale === "fr";
  if (event.note?.trim()) return event.note;
  if (event.proofUrl) return isFr ? "Piece jointe partagee." : "Attachment shared.";
  return formatStatus(event.status, locale) || (isFr ? "Mise a jour shipment" : "Shipment update");
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

function isImageProof(proofUrl: string | null | undefined, proofType: string | null | undefined) {
  if (!proofUrl) return false;
  if (proofType?.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(proofUrl);
}

function proofLabel(event: GpEvent, locale: string) {
  const isFr = locale === "fr";
  if (isImageProof(event.proofUrl, event.proofType)) return isFr ? "Preuve photo" : "Photo proof";
  return isFr ? "Piece jointe" : "Attachment";
}

type LoadMode = "replace" | "prepend" | "sync";

export default function GpConversationThread({ locale, meId, meRole, shipmentId, onBackToList }: Props) {
  const isFr = locale === "fr";
  const [shipment, setShipment] = useState<GpShipment | null>(null);
  const [events, setEvents] = useState<GpEvent[]>([]);
  const [counterpart, setCounterpart] = useState<Counterpart>(null);
  const [presence, setPresence] = useState<MessagePresenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const preserveScrollRef = useRef<{ top: number; height: number } | null>(null);
  const eventsRef = useRef<GpEvent[]>([]);
  const wasNearBottomRef = useRef(true);
  const pollIntervalMs = useAdaptivePolling({ active: Boolean(shipmentId) });
  const presencePingIntervalMs = useAdaptivePolling({ active: Boolean(shipmentId), visibleIntervalMs: 45000, hiddenIntervalMs: 120000 });

  const canConfirmReceipt = useMemo(() => {
    if (!shipment) return false;
    const isAdmin = meRole === "ADMIN";
    const isParticipant = shipment.senderId === meId || shipment.receiverId === meId;
    return (isAdmin || isParticipant) && ["ARRIVED", "DELIVERED"].includes(shipment.status);
  }, [meId, meRole, shipment]);

  const groupedEvents = useMemo(() => {
    return events.map((event, index) => {
      const previous = events[index - 1] ?? null;
      const showDateSeparator = !previous || dayLabel(previous.createdAt, locale) !== dayLabel(event.createdAt, locale);
      const groupedWithPrevious = Boolean(previous) && previous.actorId === event.actorId && !showDateSeparator;
      return { event, showDateSeparator, groupedWithPrevious, isLast: index === events.length - 1 };
    });
  }, [events, locale]);

  const latestProofs = useMemo(() => [...events].filter((event) => Boolean(event.proofUrl)).slice(-3).reverse(), [events]);

  const participantLabel =
    shipment?.transporterId === meId
      ? isFr
        ? "Transporteur"
        : "Transporter"
      : shipment?.senderId === meId
        ? isFr
          ? "Expediteur"
          : "Sender"
        : shipment?.receiverId === meId
          ? isFr
            ? "Destinataire"
            : "Receiver"
          : meRole === "ADMIN"
            ? isFr
              ? "Vue admin"
              : "Admin view"
            : isFr
              ? "Participant"
              : "Participant";

  const loadThread = useCallback(async ({ silent = false, before = null, mode = "replace" }: { silent?: boolean; before?: string | null; mode?: LoadMode }) => {
    if (!silent && mode !== "prepend") setLoading(true);
    if (mode === "prepend") setLoadingOlder(true);

    try {
      const search = new URLSearchParams();
      search.set("take", "24");
      if (before) search.set("before", before);

      const response = await fetch(`/api/gp/shipments/${shipmentId}/timeline?${search.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(toErrorMessage(data, isFr ? "Conversation GP indisponible." : "GP thread unavailable."));
      }

      const nextEvents = Array.isArray(data.events) ? (data.events as GpEvent[]) : [];
      setShipment(data.shipment as GpShipment);
      setCounterpart(data.counterpart && typeof data.counterpart === "object" ? (data.counterpart as Counterpart) : null);
      setPresence(data.presence && typeof data.presence === "object" ? (data.presence as MessagePresenceSummary) : null);

      if (mode !== "sync" || eventsRef.current.length === 0) {
        setHasMore(Boolean(data.pagination?.hasMore));
        setNextCursor(typeof data.pagination?.nextCursor === "string" ? data.pagination.nextCursor : null);
      }

      if (mode === "prepend") {
        setEvents((current) => {
          const seen = new Set(current.map((event) => event.id));
          return [...nextEvents.filter((event) => !seen.has(event.id)), ...current];
        });
      } else if (mode === "sync") {
        setEvents((current) => {
          const merged = new Map(current.map((event) => [event.id, event]));
          for (const event of nextEvents) merged.set(event.id, event);
          return [...merged.values()].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
        });
      } else {
        setEvents(nextEvents);
      }

      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : isFr ? "Erreur de chargement." : "Loading error.");
    } finally {
      if (!silent && mode !== "prepend") setLoading(false);
      if (mode === "prepend") setLoadingOlder(false);
    }
  }, [isFr, shipmentId]);

  useEffect(() => {
    void loadThread({ silent: false, mode: "replace" });
  }, [loadThread]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (pollIntervalMs === null) return;
    const interval = window.setInterval(() => {
      void loadThread({ silent: true, mode: "sync" });
    }, pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [loadThread, pollIntervalMs]);

  useEffect(() => {
    async function pingPresence() {
      try {
        await fetch("/api/messages/presence", { method: "POST", cache: "no-store" });
      } catch {
        return;
      }
    }

    void pingPresence();
    if (presencePingIntervalMs === null) return;
    const interval = window.setInterval(() => {
      void pingPresence();
    }, presencePingIntervalMs);
    return () => window.clearInterval(interval);
  }, [presencePingIntervalMs]);

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

  const onScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceToBottom < 120;
    wasNearBottomRef.current = nearBottom;
    if (nearBottom) setShowJumpButton(false);
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
      preserveScrollRef.current = { top: container.scrollTop, height: container.scrollHeight };
    }
    await loadThread({ silent: true, before: nextCursor, mode: "prepend" });
  };

  const uploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
    setAttachmentError(null);
    setSendError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== "string") {
        throw new Error(toErrorMessage(data, isFr ? "Upload impossible." : "Upload failed."));
      }
      setAttachment({ url: data.url, type: file.type || null });
    } catch (uploadFailure) {
      setAttachmentError(uploadFailure instanceof Error ? uploadFailure.message : isFr ? "Upload impossible." : "Upload failed.");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !attachment) || sending) return;

    setSending(true);
    setSendError(null);
    setAttachmentError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/gp/shipments/${shipmentId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: message, proofUrl: attachment?.url, proofType: attachment?.type }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(toErrorMessage(data, isFr ? "Impossible d'envoyer le message." : "Unable to send message."));
      }

      setDraft("");
      setAttachment(null);
      wasNearBottomRef.current = true;
      setNotice(isFr ? "Message partage." : "Message shared.");
      await loadThread({ silent: true, mode: "sync" });
    } catch (sendFailure) {
      setSendError(sendFailure instanceof Error ? sendFailure.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setSending(false);
    }
  };

  const confirmReceipt = async () => {
    if (!shipment || confirming) return;
    setConfirming(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/gp/shipments/${shipment.id}/confirm`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(toErrorMessage(data, isFr ? "Impossible de confirmer la reception." : "Unable to confirm receipt."));
      }
      setNotice(isFr ? "Reception confirmee." : "Receipt confirmed.");
      await loadThread({ silent: true, mode: "sync" });
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : isFr ? "Erreur de confirmation." : "Confirmation error.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex h-[min(72vh,calc(100dvh-9rem))] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/55 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.25)] sm:p-4 lg:min-h-[560px]">
        <header className="sticky top-0 z-10 shrink-0 rounded-t-xl border-b border-neutral-800 bg-neutral-950/80 px-3 py-2 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {shipment ? `${shipment.fromCity ?? "-"} -> ${shipment.toCity ?? "-"}` : "GP"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                <span>{shipment ? formatStatus(shipment.status, locale) : "-"}</span>
                <span className={`inline-flex h-2 w-2 rounded-full ${presence?.online ? "bg-emerald-400" : "bg-zinc-600"}`} aria-hidden />
                <span className="truncate">{counterpart?.name || counterpart?.email || (isFr ? "Contact" : "Contact")}</span>
                <span className="truncate text-zinc-500">{formatPresenceLabel(presence, locale)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onBackToList ? (
                <button type="button" onClick={onBackToList} className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-200">
                  {isFr ? "Retour" : "Back"}
                </button>
              ) : null}
              <Link href="/gp/shipments" className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300/60">
                {isFr ? "Ops" : "Ops"}
              </Link>
            </div>
          </div>
        </header>

        <div className="relative mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/70">
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
            {hasMore ? (
              <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/30 disabled:opacity-60">
                {loadingOlder ? (isFr ? "Chargement..." : "Loading...") : (isFr ? "Charger des mises a jour plus anciennes" : "Load older updates")}
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
              <p className="text-xs text-zinc-500">{isFr ? "Aucune mise a jour." : "No updates yet."}</p>
            ) : (
              <div className="space-y-2">
                {groupedEvents.map(({ event, showDateSeparator, groupedWithPrevious, isLast }) => {
                  const mine = event.actorId === meId;
                  const imageProof = isImageProof(event.proofUrl, event.proofType);

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
                        <article className={`max-w-[88%] rounded-2xl border px-3 py-2 text-xs transition-opacity motion-safe:animate-[fadeIn_0.2s_ease] ${mine ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-zinc-900 text-zinc-100"} ${isLast ? "ring-1 ring-emerald-300/10" : ""}`}>
                          {!groupedWithPrevious ? (
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] text-zinc-400">{event.actor?.name || event.actor?.email || (isFr ? "Utilisateur" : "User")}</p>
                              <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">{formatStatus(event.status, locale)}</span>
                            </div>
                          ) : null}

                          <p className="mt-1 whitespace-pre-wrap break-words">{eventNarrative(event, locale)}</p>

                          {event.proofUrl ? (
                            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">{proofLabel(event, locale)}</span>
                                <a href={event.proofUrl} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-300 underline">{isFr ? "Ouvrir" : "Open"}</a>
                              </div>
                              {imageProof ? <img src={event.proofUrl} alt={proofLabel(event, locale)} className="max-h-52 w-full rounded-lg object-cover" /> : null}
                            </div>
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
            <button type="button" onClick={jumpToBottom} className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
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
                    if ((draft.trim().length > 0 || attachment) && !sending) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                rows={2}
                placeholder={isFr ? "Partager une mise a jour, une question, une photo..." : "Share an update, a question, a photo..."}
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
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAttachment || sending} aria-label={isFr ? "Joindre une preuve" : "Attach proof"} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800/70 bg-neutral-900/40 text-neutral-300 transition-all duration-200 ease-out hover:border-emerald-400/20 hover:bg-neutral-800/40 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60">
                  <span className="sr-only">{isFr ? "Joindre" : "Attach"}</span>
                  {uploadingAttachment ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 animate-spin"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l8.49-8.49a4 4 0 1 1 5.66 5.66l-8.5 8.5a2 2 0 0 1-2.82-2.83l7.78-7.78" /></svg>
                  )}
                </button>
                <button type="submit" disabled={sending || (draft.trim().length === 0 && !attachment)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" aria-label={isFr ? "Envoyer" : "Send"}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" /></svg>
                </button>
              </div>
            </div>
            {attachment ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                <a href={attachment.url} target="_blank" rel="noreferrer" className="truncate text-emerald-300 underline">{isFr ? "Preuve prete" : "Attachment ready"}</a>
                <button type="button" onClick={() => setAttachment(null)} className="rounded-full border border-white/20 px-2 py-0.5 text-[10px]">{isFr ? "Retirer" : "Remove"}</button>
              </div>
            ) : null}
            {attachmentError ? <p className="mt-1 text-xs text-rose-300">{attachmentError}</p> : null}
            {sendError ? <p className="mt-1 text-xs text-rose-300">{sendError}</p> : null}
            {notice ? <p className="mt-1 text-xs text-emerald-300">{notice}</p> : null}
          </form>
        </div>
      </section>

      <aside className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Centre Ops GP" : "GP ops center"}</p>
          <p className="mt-1 text-sm font-semibold text-white">{participantLabel}</p>
        </div>

        <div className="mt-3 space-y-3 text-xs text-zinc-300">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/65 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{isFr ? "Shipment" : "Shipment"}</p>
            <p className="mt-1"><span className="text-zinc-500">Code:</span> {shipment?.code ?? "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Trajet" : "Route"}:</span> {shipment ? `${shipment.fromCity ?? "-"} -> ${shipment.toCity ?? "-"}` : "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Poids" : "Weight"}:</span> {shipment?.weightKg ?? "-"} kg</p>
            <p><span className="text-zinc-500">{isFr ? "Statut" : "Status"}:</span> {shipment ? formatStatus(shipment.status, locale) : "-"}</p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/65 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{isFr ? "Participants" : "Participants"}</p>
            <p className="mt-1"><span className="text-zinc-500">{isFr ? "Expediteur" : "Sender"}:</span> {shipment?.sender?.name || shipment?.sender?.email || "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Destinataire" : "Receiver"}:</span> {shipment?.receiver?.name || shipment?.receiver?.email || "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Transporteur" : "Transporter"}:</span> {shipment?.transporter?.name || shipment?.transporter?.email || "-"}</p>
          </div>

          {latestProofs.length > 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/65 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{isFr ? "Preuves recentes" : "Recent proofs"}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {latestProofs.map((event) => (
                  <a key={event.id} href={event.proofUrl ?? "#"} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80">
                    {event.proofUrl && isImageProof(event.proofUrl, event.proofType) ? (
                      <img src={event.proofUrl} alt={proofLabel(event, locale)} className="h-20 w-full object-cover transition group-hover:scale-[1.03]" />
                    ) : (
                      <div className="grid h-20 place-items-center text-[10px] text-zinc-400">{proofLabel(event, locale)}</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href="/gp/shipments" className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60">{isFr ? "Ouvrir ops" : "Open ops"}</Link>
            <button type="button" onClick={() => void loadThread({ silent: false, mode: "replace" })} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-200 transition hover:border-white/40">{isFr ? "Rafraichir" : "Refresh"}</button>
            {canConfirmReceipt ? (
              <button type="button" onClick={() => void confirmReceipt()} disabled={confirming} className="rounded-full border border-amber-300/35 bg-amber-300/12 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:border-amber-300/60 disabled:opacity-60">
                {confirming ? (isFr ? "Confirmation..." : "Confirming...") : (isFr ? "Confirmer reception" : "Confirm receipt")}
              </button>
            ) : null}
          </div>

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      </aside>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
