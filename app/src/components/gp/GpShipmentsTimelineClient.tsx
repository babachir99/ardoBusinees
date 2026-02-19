"use client";

import { useEffect, useMemo, useState } from "react";

type Shipment = {
  id: string;
  code: string;
  fromCity: string;
  toCity: string;
  weightKg: number;
  status: string;
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

type Props = {
  locale: string;
  currentUserId: string | null;
  currentUserRole: string | null;
};

const proofUploadRoles = ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER"];

function formatDate(locale: string, value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
}

function toErrorMessage(data: unknown, fallback: string) {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof obj?.message === "string") return obj.message;
  if (typeof obj?.error === "string") return obj.error;
  return fallback;
}

export default function GpShipmentsTimelineClient({ locale, currentUserId, currentUserRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [openTimelineId, setOpenTimelineId] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineNotice, setTimelineNotice] = useState<string | null>(null);
  const [attachingProofId, setAttachingProofId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelinePayload | null>(null);

  const emptyLabel = useMemo(
    () => (locale === "fr" ? "Aucun shipment actif." : "No active shipment."),
    [locale]
  );

  const canAttachProof = useMemo(
    () => Boolean(currentUserRole && proofUploadRoles.includes(currentUserRole)),
    [currentUserRole]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadShipments() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const response = await fetch("/api/gp/shipments?mine=1&status=ACTIVE", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);
        if (cancelled) return;

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
        if (!cancelled) {
          setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadShipments();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function openTimeline(shipmentId: string) {
    if (openTimelineId === shipmentId) {
      setOpenTimelineId(null);
      setTimeline(null);
      setTimelineError(null);
      setTimelineNotice(null);
      return;
    }

    setOpenTimelineId(shipmentId);
    setTimelineLoading(true);
    setTimelineError(null);
    setTimelineNotice(null);
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

      const payload = data as TimelinePayload;
      setTimeline(payload);
    } catch {
      setTimelineError(locale === "fr" ? "Erreur serveur." : "Server error.");
    } finally {
      setTimelineLoading(false);
    }
  }

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
        headers: {
          "Content-Type": "application/json",
        },
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

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">
          {locale === "fr" ? "Shipments GP actifs" : "Active GP shipments"}
        </h2>
      </div>

      {loading && <p className="mt-4 text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
      {errorMsg && <p className="mt-4 text-sm text-rose-300">{errorMsg}</p>}

      {!loading && !errorMsg && shipments.length === 0 && (
        <p className="mt-4 text-sm text-zinc-400">{emptyLabel}</p>
      )}

      {!loading && !errorMsg && shipments.length > 0 && (
        <div className="mt-4 grid gap-3">
          {shipments.map((shipment) => (
            <article key={shipment.id} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {shipment.fromCity} -&gt; {shipment.toCity}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {shipment.code} - {shipment.weightKg} kg - {shipment.status}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {locale === "fr" ? "Maj" : "Updated"}: {formatDate(locale, shipment.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openTimeline(shipment.id)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:border-white/50"
                >
                  {openTimelineId === shipment.id
                    ? locale === "fr"
                      ? "Masquer"
                      : "Hide"
                    : locale === "fr"
                      ? "Timeline"
                      : "Timeline"}
                </button>
              </div>

              {openTimelineId === shipment.id && (
                <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  {timelineLoading && <p className="text-xs text-zinc-300">{locale === "fr" ? "Chargement timeline..." : "Loading timeline..."}</p>}
                  {timelineError && <p className="text-xs text-rose-300">{timelineError}</p>}
                  {timelineNotice && <p className="text-xs text-emerald-300">{timelineNotice}</p>}
                  {!timelineLoading && !timelineError && timeline && (
                    <div className="grid gap-2 text-xs text-zinc-200">
                      {timeline.events.map((event) => (
                        <div key={event.id} className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-white">{event.status}</p>
                            {event.proofUrl ? (
                              <a
                                href={event.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-cyan-300/40 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-200"
                              >
                                {locale === "fr" ? "Voir preuve" : "View proof"}
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">{formatDate(locale, event.createdAt)}</p>
                          {event.note && <p className="mt-1 text-[11px] text-zinc-300">{event.note}</p>}
                          {event.proofType && (
                            <p className="mt-1 text-[11px] text-zinc-500">{event.proofType}</p>
                          )}

                          {canAttachProof && (
                            <div className="mt-2">
                              <label className="inline-flex cursor-pointer items-center rounded-full border border-white/20 px-2 py-1 text-[11px] font-semibold text-white transition hover:border-white/50">
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
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
