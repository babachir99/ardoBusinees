"use client";

import { useState } from "react";
import { type TiakDelivery, type TiakUserLite } from "@/components/tiak/types";

type MatchCourier = {
  id: string;
  name: string | null;
  image: string | null;
  ratingAvg: number;
  ratingCount: number;
  etaLabel: string;
  isOnline?: boolean;
  zones?: string[];
  cities?: string[];
  activeJobsCount?: number;
  score?: number;
};

type Props = {
  locale: string;
  delivery: TiakDelivery;
  isLoggedIn: boolean;
  currentUserId: string | null;
  currentUserRole: string | null;
  onRequireLogin: () => void;
  onAssigned: (next: TiakDelivery) => void;
};

function formatRating(value: number) {
  if (!Number.isFinite(value)) return "0.0";
  return Math.max(0, Math.min(5, value)).toFixed(1);
}

function toErrorMessage(data: unknown, fallback: string) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof record?.message === "string") return record.message;
  if (typeof record?.error === "string") return record.error;
  return fallback;
}

export default function TiakCourierMatcher({
  locale,
  delivery,
  isLoggedIn,
  currentUserId,
  currentUserRole,
  onRequireLogin,
  onAssigned,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [couriers, setCouriers] = useState<MatchCourier[]>([]);
  const [assigningCourierId, setAssigningCourierId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN";
  const isOwner = Boolean(currentUserId && currentUserId === delivery.customerId);
  const canMatch = (isOwner || isAdmin) && delivery.status === "REQUESTED";

  if (!canMatch) return null;

  async function openAndLoad() {
    setOpen((current) => !current);
    if (open) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/tiak/matching/couriers?jobId=${delivery.id}&take=5&locale=${locale}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMsg(
          toErrorMessage(
            data,
            locale === "fr" ? "Matching indisponible." : "Matching unavailable."
          )
        );
        return;
      }

      const parsed = data && typeof data === "object" ? (data as { couriers?: unknown }).couriers : [];
      setCouriers(Array.isArray(parsed) ? (parsed as MatchCourier[]) : []);
    } catch {
      setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
    } finally {
      setLoading(false);
    }
  }

  async function assignCourier(courierId: string, courierLite: TiakUserLite) {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setAssigningCourierId(courierId);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/tiak/jobs/${delivery.id}/assign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courierId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMsg(
          toErrorMessage(
            data,
            locale === "fr" ? "Assignation impossible." : "Assignment failed."
          )
        );
        return;
      }

      const assignedCourierId =
        data && typeof data === "object" && data.job && typeof data.job === "object"
          ? (data.job as { assignedCourierId?: unknown }).assignedCourierId
          : null;

      const assignedStatus =
        data && typeof data === "object" && data.job && typeof data.job === "object"
          ? (data.job as { status?: unknown }).status
          : null;

      onAssigned({
        ...delivery,
        status: (typeof assignedStatus === "string" ? assignedStatus : "ACCEPTED") as TiakDelivery["status"],
        courierId: typeof assignedCourierId === "string" ? assignedCourierId : courierId,
        courier: courierLite,
      });

      setOpen(false);
    } catch {
      setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
    } finally {
      setAssigningCourierId(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
      <button
        type="button"
        onClick={() => void openAndLoad()}
        className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
      >
        {locale === "fr" ? "Trouver un livreur" : "Find courier"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-xs text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
          {errorMsg && <p className="text-xs text-rose-300">{errorMsg}</p>}

          {!loading && !errorMsg && couriers.length === 0 && (
            <p className="text-xs text-zinc-400">
              {locale === "fr" ? "Aucun livreur disponible pour cette zone." : "No courier available for this area."}
            </p>
          )}

          {!loading && !errorMsg && couriers.length > 0 && (
            <div className="grid gap-2">
              {couriers.map((courier) => (
                <article key={courier.id} className="rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">{courier.name ?? "Courier"}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        ? {formatRating(courier.ratingAvg)} ({courier.ratingCount}) ? {courier.etaLabel}
                      </p>
                      {Array.isArray(courier.zones) && courier.zones.length > 0 && (
                        <p className="mt-1 text-[11px] text-zinc-500">{courier.zones.slice(0, 3).join(", ")}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={assigningCourierId !== null}
                      onClick={() =>
                        void assignCourier(courier.id, {
                          id: courier.id,
                          name: courier.name,
                          image: courier.image,
                        })
                      }
                      className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 disabled:opacity-60"
                    >
                      {assigningCourierId === courier.id
                        ? locale === "fr"
                          ? "Assignation..."
                          : "Assigning..."
                        : locale === "fr"
                          ? "Assigner"
                          : "Assign"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

