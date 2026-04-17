"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Shipment = {
  id: string;
  code: string;
  fromCity: string;
  toCity: string;
  weightKg: number;
  status: string;
  senderId: string | null;
  receiverId: string | null;
  transporterId: string;
  updatedAt: string;
};

type TimelineEvent = {
  id: string;
  status: string;
  createdAt: string;
  note?: string | null;
  proofUrl?: string | null;
  proofType?: string | null;
};

type TimelinePayload = {
  shipment: { id: string; code: string; status: string };
  events: TimelineEvent[];
};

type ShipmentView = "ACTIVE" | "ARCHIVED";

const receiptConfirmedNote = "Receipt confirmed";
const proofUploadRoles = ["ADMIN", "TRANSPORTER", "GP_CARRIER"];
const activeStatuses = new Set(["DROPPED_OFF", "PICKED_UP", "BOARDED", "ARRIVED"]);

function formatDate(locale: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
}

function formatRelativeDate(locale: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return locale === "fr" ? "a l'instant" : "just now";
  if (diffMinutes < 60) {
    return locale === "fr" ? `il y a ${diffMinutes} min` : `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return locale === "fr" ? `il y a ${diffHours} h` : `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return locale === "fr" ? `il y a ${diffDays} j` : `${diffDays}d ago`;
}

function toErrorMessage(data: unknown, fallback: string) {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof obj?.message === "string") return obj.message;
  if (typeof obj?.error === "string") return obj.error;
  return fallback;
}

function isReceiptConfirmedEvent(event: TimelineEvent) {
  return event.note?.trim() === receiptConfirmedNote;
}

function isActiveShipment(status: string) {
  return activeStatuses.has(status);
}

function getShipmentTone(status: string) {
  if (status === "DELIVERED") {
    return {
      badgeClass: "border-emerald-300/35 bg-emerald-300/12 text-emerald-100",
      accentClass: "from-emerald-400/60 via-emerald-300/20 to-transparent",
    };
  }

  if (status === "ARRIVED") {
    return {
      badgeClass: "border-cyan-300/35 bg-cyan-300/12 text-cyan-100",
      accentClass: "from-cyan-400/60 via-cyan-300/20 to-transparent",
    };
  }

  if (status === "PICKED_UP" || status === "BOARDED") {
    return {
      badgeClass: "border-amber-300/35 bg-amber-300/12 text-amber-100",
      accentClass: "from-amber-400/60 via-amber-300/20 to-transparent",
    };
  }

  return {
    badgeClass: "border-white/15 bg-white/5 text-zinc-100",
    accentClass: "from-white/25 via-white/10 to-transparent",
  };
}

function getEventTone(status: string) {
  if (status === "DELIVERED") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "ARRIVED") return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  if (status === "PICKED_UP" || status === "BOARDED") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  return "border-white/10 bg-zinc-950/70 text-zinc-100";
}

function getParticipantLabel(
  locale: string,
  shipment: Shipment,
  currentUserId: string | null,
  currentUserRole: string | null
) {
  if (currentUserRole === "ADMIN") return locale === "fr" ? "Vue admin" : "Admin view";
  if (currentUserId && shipment.senderId === currentUserId) return locale === "fr" ? "Expediteur" : "Sender";
  if (currentUserId && shipment.receiverId === currentUserId) return locale === "fr" ? "Destinataire" : "Receiver";
  if (currentUserId && shipment.transporterId === currentUserId) return locale === "fr" ? "Transporteur" : "Transporter";
  return locale === "fr" ? "Participant" : "Participant";
}

type Props = {
  locale: string;
  currentUserId: string | null;
  currentUserRole: string | null;
};

export default function GpShipmentsTimelineClient({
  locale,
  currentUserId,
  currentUserRole,
}: Props) {
  const searchParams = useSearchParams();
  const requestedShipmentId = searchParams.get("shipmentId");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentView, setShipmentView] = useState<ShipmentView>("ACTIVE");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineNotice, setTimelineNotice] = useState<string | null>(null);
  const [attachingProofId, setAttachingProofId] = useState<string | null>(null);
  const [confirmingReceiptId, setConfirmingReceiptId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelinePayload | null>(null);

  const canAttachProof = useMemo(
    () => Boolean(currentUserRole && proofUploadRoles.includes(currentUserRole)),
    [currentUserRole]
  );

  const loadShipments = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const response = await fetch("/api/gp/shipments?mine=1&status=ALL", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setErrorMsg(
            toErrorMessage(
              data,
              locale === "fr" ? "Impossible de charger les shipments." : "Unable to load shipments."
            )
          );
          return;
        }

        setShipments(Array.isArray(data) ? (data as Shipment[]) : []);
      } catch {
        setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [locale]
  );

  useEffect(() => {
    void loadShipments(false);
  }, [loadShipments]);

  useEffect(() => {
    if (!requestedShipmentId) return;
    setSelectedShipmentId(requestedShipmentId);
  }, [requestedShipmentId]);

  const visibleShipments = useMemo(() => {
    const filtered = shipments.filter((shipment) =>
      shipmentView === "ACTIVE" ? isActiveShipment(shipment.status) : !isActiveShipment(shipment.status)
    );

    return filtered.sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  }, [shipmentView, shipments]);

  const selectedShipment = useMemo(() => {
    if (visibleShipments.length === 0) return null;
    return visibleShipments.find((shipment) => shipment.id === selectedShipmentId) ?? visibleShipments[0] ?? null;
  }, [selectedShipmentId, visibleShipments]);

  const activeCount = useMemo(
    () => shipments.filter((shipment) => isActiveShipment(shipment.status)).length,
    [shipments]
  );

  const archivedCount = useMemo(
    () => shipments.filter((shipment) => !isActiveShipment(shipment.status)).length,
    [shipments]
  );

  const receiptPendingCount = useMemo(
    () => shipments.filter((shipment) => ["ARRIVED", "DELIVERED"].includes(shipment.status)).length,
    [shipments]
  );

  const visibleLabel = useMemo(() => {
    if (shipmentView === "ACTIVE") {
      return locale === "fr" ? `Actifs (${visibleShipments.length})` : `Active (${visibleShipments.length})`;
    }
    return locale === "fr" ? `Archives (${visibleShipments.length})` : `Archived (${visibleShipments.length})`;
  }, [locale, shipmentView, visibleShipments.length]);

  const receiptAlreadyConfirmed = useMemo(
    () => Boolean(timeline?.events.some((event) => isReceiptConfirmedEvent(event))),
    [timeline]
  );

  const canConfirmReceipt = useMemo(() => {
    if (!selectedShipment || !currentUserId) return false;
    if (receiptAlreadyConfirmed) return false;
    if (!["ARRIVED", "DELIVERED"].includes(selectedShipment.status)) return false;
    if (currentUserRole === "ADMIN") return true;
    return selectedShipment.senderId === currentUserId || selectedShipment.receiverId === currentUserId;
  }, [currentUserId, currentUserRole, receiptAlreadyConfirmed, selectedShipment]);

  const loadTimeline = useCallback(
    async (shipmentId: string) => {
      setTimelineLoading(true);
      setTimelineError(null);
      setTimeline(null);

      try {
        const response = await fetch(`/api/gp/shipments/${shipmentId}/timeline`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setTimelineError(
            toErrorMessage(
              data,
              locale === "fr" ? "Impossible de charger la timeline." : "Unable to load timeline."
            )
          );
          return;
        }

        setTimeline(data as TimelinePayload);
      } catch {
        setTimelineError(locale === "fr" ? "Erreur serveur." : "Server error.");
      } finally {
        setTimelineLoading(false);
      }
    },
    [locale]
  );

  useEffect(() => {
    if (!selectedShipment) {
      setTimeline(null);
      setTimelineError(null);
      setTimelineNotice(null);
      return;
    }

    setTimelineNotice(null);
    void loadTimeline(selectedShipment.id);
  }, [loadTimeline, selectedShipment]);

  function patchTimelineEventProof(eventId: string, proofUrl: string, proofType: string | null) {
    setTimeline((current) => {
      if (!current) return current;
      return {
        ...current,
        events: current.events.map((entry) =>
          entry.id === eventId ? { ...entry, proofUrl, proofType } : entry
        ),
      };
    });
  }

  async function attachProof(eventId: string, file: File) {
    setAttachingProofId(eventId);
    setTimelineError(null);
    setTimelineNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploadData || typeof uploadData.url !== "string") {
        setTimelineError(
          toErrorMessage(
            uploadData,
            locale === "fr" ? "Upload de preuve impossible." : "Unable to upload proof."
          )
        );
        return;
      }

      const patchResponse = await fetch(`/api/gp/shipments/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofUrl: uploadData.url,
          proofType: file.type || undefined,
        }),
      });

      const patchData = await patchResponse.json().catch(() => null);
      if (!patchResponse.ok) {
        setTimelineError(
          toErrorMessage(
            patchData,
            locale === "fr" ? "Ajout de preuve refuse." : "Proof attachment denied."
          )
        );
        return;
      }

      const nextProofUrl =
        patchData && typeof patchData === "object" && patchData.event && typeof patchData.event === "object"
          ? (patchData.event as { proofUrl?: unknown }).proofUrl
          : null;
      const nextProofType =
        patchData && typeof patchData === "object" && patchData.event && typeof patchData.event === "object"
          ? (patchData.event as { proofType?: unknown }).proofType
          : null;

      if (typeof nextProofUrl === "string") {
        patchTimelineEventProof(eventId, nextProofUrl, typeof nextProofType === "string" ? nextProofType : null);
      }

      setTimelineNotice(locale === "fr" ? "Preuve photo attachee." : "Photo proof attached.");
    } catch {
      setTimelineError(locale === "fr" ? "Erreur serveur." : "Server error.");
    } finally {
      setAttachingProofId(null);
    }
  }

  async function confirmReceipt(shipmentId: string) {
    setConfirmingReceiptId(shipmentId);
    setTimelineError(null);
    setTimelineNotice(null);

    try {
      const response = await fetch(`/api/gp/shipments/${shipmentId}/confirm`, {
        method: "POST",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setTimelineError(
          toErrorMessage(
            data,
            locale === "fr" ? "Confirmation de reception impossible." : "Unable to confirm receipt."
          )
        );
        return;
      }

      const nextShipment =
        data && typeof data === "object" && data.shipment && typeof data.shipment === "object"
          ? (data.shipment as { id?: unknown; status?: unknown })
          : null;
      const nextEvent =
        data && typeof data === "object" && data.event && typeof data.event === "object"
          ? (data.event as TimelineEvent)
          : null;
      const alreadyConfirmed =
        data && typeof data === "object" && typeof (data as { alreadyConfirmed?: unknown }).alreadyConfirmed === "boolean"
          ? Boolean((data as { alreadyConfirmed?: boolean }).alreadyConfirmed)
          : false;

      if (nextShipment?.id === shipmentId) {
        const now = new Date().toISOString();
        setShipments((current) =>
          current.map((entry) =>
            entry.id === shipmentId
              ? {
                  ...entry,
                  status: typeof nextShipment.status === "string" ? nextShipment.status : entry.status,
                  updatedAt: now,
                }
              : entry
          )
        );
      }

      if (nextEvent) {
        setTimeline((current) => {
          if (!current || current.shipment.id !== shipmentId) return current;
          const exists = current.events.some((entry) => entry.id === nextEvent.id);
          return {
            shipment: {
              ...current.shipment,
              status:
                nextShipment && typeof nextShipment.status === "string"
                  ? nextShipment.status
                  : current.shipment.status,
            },
            events: exists ? current.events : [...current.events, nextEvent],
          };
        });
      }

      setTimelineNotice(
        alreadyConfirmed
          ? locale === "fr"
            ? "La reception etait deja confirmee."
            : "Receipt was already confirmed."
          : locale === "fr"
            ? "Reception confirmee."
            : "Receipt confirmed."
      );
    } catch {
      setTimelineError(locale === "fr" ? "Erreur serveur." : "Server error.");
    } finally {
      setConfirmingReceiptId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_22px_50px_rgba(0,0,0,0.24)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/85">GP Ops</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {locale === "fr" ? "Centre de suivi shipments" : "Shipments control center"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr"
              ? "Suivi live des preuves, etapes et confirmations de reception."
              : "Track proofs, milestones and receipt confirmations in one place."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadShipments(true);
            if (selectedShipment) {
              void loadTimeline(selectedShipment.id);
            }
          }}
          className="inline-flex items-center rounded-full border border-white/15 bg-zinc-950/70 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-zinc-900"
        >
          {refreshing
            ? locale === "fr"
              ? "Rafraichissement..."
              : "Refreshing..."
            : locale === "fr"
              ? "Rafraichir"
              : "Refresh"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {locale === "fr" ? "Actifs" : "Active"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{activeCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {locale === "fr"
              ? "Shipments encore en transit ou a confirmer."
              : "Shipments still moving or waiting for receipt."}
          </p>
        </article>
        <article className="rounded-2xl border border-amber-300/15 bg-amber-300/5 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">
            {locale === "fr" ? "A confirmer" : "Pending receipt"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{receiptPendingCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {locale === "fr"
              ? "Courses arrivees ou livrees en attente de validation."
              : "Arrived or delivered items waiting for confirmation."}
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">
            {locale === "fr" ? "Archives" : "Archived"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{archivedCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {locale === "fr"
              ? "Historique livre avec preuves et confirmation."
              : "Delivered history with proofs and confirmations."}
          </p>
        </article>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-zinc-950/70 p-1">
          {([
            { key: "ACTIVE", label: locale === "fr" ? `Actifs (${activeCount})` : `Active (${activeCount})` },
            { key: "ARCHIVED", label: locale === "fr" ? `Archives (${archivedCount})` : `Archived (${archivedCount})` },
          ] as const).map((tab) => {
            const active = shipmentView === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setShipmentView(tab.key)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-cyan-300 text-zinc-950 shadow-[0_10px_24px_rgba(34,211,238,0.28)]"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">{visibleLabel}</p>
      </div>

      {loading ? <p className="mt-5 text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p> : null}
      {errorMsg ? <p className="mt-5 text-sm text-rose-300">{errorMsg}</p> : null}

      {!loading && !errorMsg && visibleShipments.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-400">
          {shipmentView === "ACTIVE"
            ? locale === "fr"
              ? "Aucun shipment actif pour le moment."
              : "No active shipments right now."
            : locale === "fr"
              ? "Aucun shipment archive pour le moment."
              : "No archived shipments yet."}
        </div>
      ) : null}

      {!loading && !errorMsg && visibleShipments.length > 0 ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-zinc-950/45 p-3 xl:sticky xl:top-24">
            <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1 xl:max-h-[70vh]">
              {visibleShipments.map((shipment) => {
                const active = selectedShipment?.id === shipment.id;
                const tone = getShipmentTone(shipment.status);
                return (
                  <button
                    key={shipment.id}
                    type="button"
                    onClick={() => {
                      setSelectedShipmentId(shipment.id);
                      setTimelineNotice(null);
                    }}
                    className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                      active
                        ? "border-cyan-300/35 bg-zinc-900/90 shadow-[0_16px_34px_rgba(34,211,238,0.12)]"
                        : "border-white/10 bg-zinc-950/70 hover:border-cyan-300/20 hover:bg-zinc-900/80"
                    }`}
                  >
                    <div className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${tone.accentClass}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 pl-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {shipment.fromCity} -&gt; {shipment.toCity}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-400">{shipment.code}</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone.badgeClass}`}>
                        {shipment.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-2 text-[11px] text-zinc-500">
                      <span>{shipment.weightKg} kg</span>
                      <span>&bull;</span>
                      <span>{formatRelativeDate(locale, shipment.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4 md:p-5">
            {selectedShipment ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_40%),rgba(9,9,11,0.92)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
                        {getParticipantLabel(locale, selectedShipment, currentUserId, currentUserRole)}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">
                        {selectedShipment.fromCity} -&gt; {selectedShipment.toCity}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        {locale === "fr" ? "Code shipment" : "Shipment code"}: {selectedShipment.code}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getShipmentTone(selectedShipment.status).badgeClass}`}>
                        {selectedShipment.status}
                      </span>
                      {canConfirmReceipt ? (
                        <button
                          type="button"
                          onClick={() => void confirmReceipt(selectedShipment.id)}
                          disabled={confirmingReceiptId === selectedShipment.id}
                          className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/70 disabled:opacity-60"
                        >
                          {confirmingReceiptId === selectedShipment.id
                            ? locale === "fr"
                              ? "Confirmation..."
                              : "Confirming..."
                            : locale === "fr"
                              ? "Confirmer reception"
                              : "Confirm receipt"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{locale === "fr" ? "Poids" : "Weight"}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{selectedShipment.weightKg} kg</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{locale === "fr" ? "Derniere maj" : "Last update"}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatRelativeDate(locale, selectedShipment.updatedAt)}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{formatDate(locale, selectedShipment.updatedAt)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{locale === "fr" ? "Confirmation" : "Receipt"}</p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {receiptAlreadyConfirmed
                          ? locale === "fr"
                            ? "Reception deja confirmee"
                            : "Receipt already confirmed"
                          : locale === "fr"
                            ? "En attente si disponible"
                            : "Pending when available"}
                      </p>
                    </div>
                  </div>
                </section>

                {timelineNotice ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200">{timelineNotice}</p> : null}
                {timelineError ? <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-200">{timelineError}</p> : null}

                <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{locale === "fr" ? "Timeline ops" : "Ops timeline"}</h4>
                      <p className="mt-1 text-xs text-zinc-400">
                        {locale === "fr"
                          ? "Preuves, jalons et reception finale dans un seul flux."
                          : "Proofs, milestones and final receipt in one flow."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadTimeline(selectedShipment.id)}
                      className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-cyan-300/35"
                    >
                      {locale === "fr" ? "Rafraichir la timeline" : "Refresh timeline"}
                    </button>
                  </div>

                  {timelineLoading ? (
                    <div className="mt-4 space-y-3">
                      {[0, 1, 2].map((item) => (
                        <div key={item} className="h-20 animate-pulse rounded-xl bg-zinc-800/60" />
                      ))}
                    </div>
                  ) : null}

                  {!timelineLoading && timeline ? (
                    <div className="mt-4 space-y-3">
                      {timeline.events.map((event) => (
                        <article key={event.id} className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${getEventTone(event.status)}`}>
                          <div className="absolute inset-y-0 left-0 w-1 bg-white/10" />
                          <div className="ml-2 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-white">{event.status}</p>
                                {isReceiptConfirmedEvent(event) ? (
                                  <span className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                    {locale === "fr" ? "Client confirme" : "Receipt confirmed"}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-zinc-400">{formatDate(locale, event.createdAt)}</p>
                            </div>

                            {event.proofUrl ? (
                              <a href={event.proofUrl} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/40 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-200">
                                {locale === "fr" ? "Voir preuve" : "View proof"}
                              </a>
                            ) : null}
                          </div>

                          {event.note ? <p className="ml-2 mt-2 text-xs text-zinc-200">{event.note}</p> : null}
                          {event.proofType ? <p className="ml-2 mt-1 text-[11px] text-zinc-500">{event.proofType}</p> : null}

                          {canAttachProof && !event.proofUrl ? (
                            <div className="ml-2 mt-3">
                              <label className="inline-flex cursor-pointer items-center rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:border-white/50">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={attachingProofId === event.id || !currentUserId}
                                  onChange={(inputEvent) => {
                                    const file = inputEvent.target.files?.[0];
                                    inputEvent.target.value = "";
                                    if (!file) return;
                                    void attachProof(event.id, file);
                                  }}
                                />
                                {attachingProofId === event.id
                                  ? locale === "fr"
                                    ? "Upload..."
                                    : "Uploading..."
                                  : locale === "fr"
                                    ? "Ajouter preuve"
                                    : "Add proof"}
                              </label>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
