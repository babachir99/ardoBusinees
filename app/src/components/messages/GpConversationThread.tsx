"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function describeEvent(event: GpEvent, locale: string) {
  const isFr = locale === "fr";
  if (event.note?.trim()) {
    return event.note;
  }
  return formatStatus(event.status, locale) || (isFr ? "Mise a jour shipment" : "Shipment update");
}

type LoadMode = "replace" | "prepend" | "sync";

export default function GpConversationThread({
  locale,
  meId,
  meRole,
  shipmentId,
  onBackToList,
}: Props) {
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollRef = useRef<{ top: number; height: number } | null>(null);
  const eventsRef = useRef<GpEvent[]>([]);
  const pollIntervalMs = useAdaptivePolling({ active: Boolean(shipmentId) });
  const presencePingIntervalMs = useAdaptivePolling({
    active: Boolean(shipmentId),
    visibleIntervalMs: 45000,
    hiddenIntervalMs: 120000,
  });

  const canConfirmReceipt = useMemo(() => {
    if (!shipment) return false;
    const isAdmin = meRole === "ADMIN";
    const isParticipant = shipment.senderId === meId || shipment.receiverId === meId;
    return (isAdmin || isParticipant) && ["ARRIVED", "DELIVERED"].includes(shipment.status);
  }, [meId, meRole, shipment]);

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
      if (!silent && mode !== "prepend") {
        setLoading(true);
      }
      if (mode === "prepend") {
        setLoadingOlder(true);
      }

      try {
        const search = new URLSearchParams();
        search.set("take", "24");
        if (before) search.set("before", before);

        const response = await fetch(`/api/gp/shipments/${shipmentId}/timeline?${search.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(
            toErrorMessage(data, isFr ? "Conversation GP indisponible." : "GP thread unavailable.")
          );
        }

        const nextEvents = Array.isArray(data.events) ? (data.events as GpEvent[]) : [];
        setShipment(data.shipment as GpShipment);
        setCounterpart(
          data.counterpart && typeof data.counterpart === "object" ? (data.counterpart as Counterpart) : null
        );
        setPresence(
          data.presence && typeof data.presence === "object"
            ? (data.presence as MessagePresenceSummary)
            : null
        );

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
            for (const event of nextEvents) {
              merged.set(event.id, event);
            }
            return [...merged.values()].sort(
              (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
            );
          });
        } else {
          setEvents(nextEvents);
        }

        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : isFr ? "Erreur de chargement." : "Loading error."
        );
      } finally {
        if (!silent && mode !== "prepend") {
          setLoading(false);
        }
        if (mode === "prepend") {
          setLoadingOlder(false);
        }
      }
    },
    [isFr, shipmentId]
  );

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
        await fetch("/api/messages/presence", {
          method: "POST",
          cache: "no-store",
        });
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

    container.scrollTop = container.scrollHeight;
  }, [events.length]);

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

  const confirmReceipt = async () => {
    if (!shipment || confirming) return;

    setConfirming(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/gp/shipments/${shipment.id}/confirm`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          toErrorMessage(data, isFr ? "Impossible de confirmer la reception." : "Unable to confirm receipt.")
        );
      }

      setNotice(isFr ? "Reception confirmee." : "Receipt confirmed.");
      await loadThread({ silent: true, mode: "sync" });
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : isFr
            ? "Erreur de confirmation."
            : "Confirmation error."
      );
    } finally {
      setConfirming(false);
    }
  };

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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
        <div className="border-b border-neutral-800 pb-3">
          {onBackToList ? (
            <button
              type="button"
              onClick={onBackToList}
              className="mb-3 inline-flex rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-white/35"
            >
              {isFr ? "Retour aux conversations" : "Back to conversations"}
            </button>
          ) : null}
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {isFr ? "Fil GP" : "GP thread"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              {shipment ? `${shipment.fromCity ?? "-"} -> ${shipment.toCity ?? "-"}` : "GP"}
            </h3>
            <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
              {shipment ? formatStatus(shipment.status, locale) : "-"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className={`inline-flex h-2 w-2 rounded-full ${presence?.online ? "bg-emerald-400" : "bg-zinc-600"}`} aria-hidden />
            <span>{counterpart?.name || counterpart?.email || (isFr ? "Contact" : "Contact")}</span>
            <span>{formatPresenceLabel(presence, locale)}</span>
          </div>
        </div>

        <div ref={scrollRef} className="mt-3 h-[min(66vh,calc(100dvh-12rem))] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/70 p-3 lg:h-[480px]">
          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="mb-3 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/30 disabled:opacity-60"
            >
              {loadingOlder
                ? isFr
                  ? "Chargement..."
                  : "Loading..."
                : isFr
                  ? "Charger des mises a jour plus anciennes"
                  : "Load older updates"}
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
          ) : events.length === 0 ? (
            <p className="text-xs text-zinc-500">{isFr ? "Aucune mise a jour." : "No updates yet."}</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const mine = event.actorId === meId;
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
                      <p className="text-[11px] text-zinc-400">
                        {event.actor?.name || event.actor?.email || (isFr ? "Utilisateur" : "User")}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {new Date(event.createdAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
                      </p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">{describeEvent(event, locale)}</p>
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
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            {isFr ? "Centre Ops GP" : "GP ops center"}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{participantLabel}</p>
        </div>

        <div className="mt-3 space-y-3 text-xs text-zinc-300">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/65 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              {isFr ? "Shipment" : "Shipment"}
            </p>
            <p className="mt-1"><span className="text-zinc-500">Code:</span> {shipment?.code ?? "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Trajet" : "Route"}:</span> {shipment ? `${shipment.fromCity ?? "-"} -> ${shipment.toCity ?? "-"}` : "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Poids" : "Weight"}:</span> {shipment?.weightKg ?? "-"} kg</p>
            <p><span className="text-zinc-500">{isFr ? "Statut" : "Status"}:</span> {shipment ? formatStatus(shipment.status, locale) : "-"}</p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/65 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              {isFr ? "Participants" : "Participants"}
            </p>
            <p className="mt-1"><span className="text-zinc-500">{isFr ? "Expediteur" : "Sender"}:</span> {shipment?.sender?.name || shipment?.sender?.email || "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Destinataire" : "Receiver"}:</span> {shipment?.receiver?.name || shipment?.receiver?.email || "-"}</p>
            <p><span className="text-zinc-500">{isFr ? "Transporteur" : "Transporter"}:</span> {shipment?.transporter?.name || shipment?.transporter?.email || "-"}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/gp/shipments"
              className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60"
            >
              {isFr ? "Ouvrir ops" : "Open ops"}
            </Link>
            <button
              type="button"
              onClick={() => void loadThread({ silent: false, mode: "replace" })}
              className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-200 transition hover:border-white/40"
            >
              {isFr ? "Rafraichir" : "Refresh"}
            </button>
            {canConfirmReceipt ? (
              <button
                type="button"
                onClick={() => void confirmReceipt()}
                disabled={confirming}
                className="rounded-full border border-amber-300/35 bg-amber-300/12 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:border-amber-300/60 disabled:opacity-60"
              >
                {confirming
                  ? isFr
                    ? "Confirmation..."
                    : "Confirming..."
                  : isFr
                    ? "Confirmer reception"
                    : "Confirm receipt"}
              </button>
            ) : null}
          </div>

          {notice ? <p className="text-xs text-emerald-300">{notice}</p> : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      </aside>
    </div>
  );
}
