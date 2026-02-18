"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TiakCreateDeliveryForm from "@/components/tiak/TiakCreateDeliveryForm";
import TiakDeliveryCard from "@/components/tiak/TiakDeliveryCard";
import { type TiakDelivery } from "@/components/tiak/types";

type Props = {
  locale: string;
  isLoggedIn: boolean;
  currentUserId: string | null;
  currentUserRole: string | null;
};

function upsertDelivery(list: TiakDelivery[], entry: TiakDelivery) {
  const index = list.findIndex((item) => item.id === entry.id);
  if (index === -1) {
    return [entry, ...list];
  }
  const clone = [...list];
  clone[index] = entry;
  return clone;
}

function getStoreKey(userId: string | null) {
  return userId ? `tiak-tracked:${userId}` : null;
}

function readStoredIds(key: string | null) {
  if (!key || typeof window === "undefined") return [] as string[];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  } catch {
    return [];
  }
}

function writeStoredIds(key: string | null, ids: string[]) {
  if (!key || typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(ids.slice(0, 60)));
}

export default function TiakStoreClient({ locale, isLoggedIn, currentUserId, currentUserRole }: Props) {
  const [openDeliveries, setOpenDeliveries] = useState<TiakDelivery[]>([]);
  const [trackedDeliveries, setTrackedDeliveries] = useState<TiakDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = getStoreKey(currentUserId);

  const isCourierOrAdmin = currentUserRole === "COURIER" || currentUserRole === "ADMIN";

  const requestLogin = useCallback(() => {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
  }, [locale]);

  const trackDeliveryId = useCallback(
    (id: string) => {
      const currentIds = readStoredIds(storageKey);
      if (currentIds.includes(id)) return;
      writeStoredIds(storageKey, [id, ...currentIds]);
    },
    [storageKey]
  );

  const refreshOpenDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tiak-tiak/deliveries", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : locale === "fr" ? "Chargement impossible" : "Load failed");
        return;
      }

      const next = Array.isArray(data) ? (data as TiakDelivery[]) : [];
      setOpenDeliveries(next);

      if (currentUserId) {
        const candidateIds = next
          .filter((entry) => entry.customerId === currentUserId || entry.courierId === currentUserId)
          .map((entry) => entry.id);

        if (candidateIds.length > 0) {
          const currentIds = readStoredIds(storageKey);
          writeStoredIds(storageKey, Array.from(new Set([...candidateIds, ...currentIds])));
        }
      }
    } catch {
      setError(locale === "fr" ? "Chargement impossible" : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, locale, storageKey]);

  const refreshTrackedDeliveries = useCallback(async () => {
    if (!isLoggedIn || !currentUserId) {
      setTrackedDeliveries([]);
      return;
    }

    const ids = readStoredIds(storageKey);
    if (ids.length === 0) {
      setTrackedDeliveries([]);
      return;
    }

    const loaded: TiakDelivery[] = [];
    const validIds: string[] = [];

    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(`/api/tiak-tiak/deliveries/${id}?includeAddress=1`, {
            method: "GET",
            cache: "no-store",
          });
          if (!response.ok) return;

          const data = await response.json().catch(() => null);
          if (!data || typeof data !== "object") return;

          validIds.push(id);
          loaded.push(data as TiakDelivery);
        } catch {
          return;
        }
      })
    );

    writeStoredIds(storageKey, validIds);
    loaded.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setTrackedDeliveries(loaded);
  }, [currentUserId, isLoggedIn, storageKey]);

  useEffect(() => {
    refreshOpenDeliveries();
  }, [refreshOpenDeliveries]);

  useEffect(() => {
    refreshTrackedDeliveries();
  }, [refreshTrackedDeliveries]);

  const handleDeliveryUpdated = useCallback((updated: TiakDelivery) => {
    setTrackedDeliveries((current) => upsertDelivery(current, updated));

    setOpenDeliveries((current) => {
      if (updated.status !== "REQUESTED") {
        return current.filter((entry) => entry.id !== updated.id);
      }
      return upsertDelivery(current, updated);
    });
  }, []);

  const handleCreated = useCallback((created: TiakDelivery) => {
    trackDeliveryId(created.id);
    handleDeliveryUpdated(created);
  }, [handleDeliveryUpdated, trackDeliveryId]);

  const displayedTracked = useMemo(() => {
    if (!currentUserId) return [] as TiakDelivery[];

    if (currentUserRole === "ADMIN") {
      return trackedDeliveries;
    }

    return trackedDeliveries.filter(
      (entry) => entry.customerId === currentUserId || entry.courierId === currentUserId
    );
  }, [currentUserId, currentUserRole, trackedDeliveries]);

  return (
    <div className="space-y-8">
      <TiakCreateDeliveryForm locale={locale} isLoggedIn={isLoggedIn} onCreated={handleCreated} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {locale === "fr" ? "Demandes ouvertes" : "Open requests"}
          </h2>
          <button
            type="button"
            onClick={refreshOpenDeliveries}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
          >
            {locale === "fr" ? "Rafraichir" : "Refresh"}
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {openDeliveries.map((delivery) => (
            <TiakDeliveryCard
              key={delivery.id}
              locale={locale}
              delivery={delivery}
              isLoggedIn={isLoggedIn}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onTrackDelivery={trackDeliveryId}
              onDeliveryUpdated={handleDeliveryUpdated}
              onRequireLogin={requestLogin}
            />
          ))}

          {!loading && openDeliveries.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Aucune demande ouverte." : "No open requests."}
            </div>
          )}
        </div>
      </section>

      {isLoggedIn && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            {isCourierOrAdmin
              ? locale === "fr"
                ? "Mes livraisons"
                : "My deliveries"
              : locale === "fr"
                ? "Mes demandes"
                : "My requests"}
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            {displayedTracked.map((delivery) => (
              <TiakDeliveryCard
                key={`tracked-${delivery.id}`}
                locale={locale}
                delivery={delivery}
                isLoggedIn={isLoggedIn}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onTrackDelivery={trackDeliveryId}
                onDeliveryUpdated={handleDeliveryUpdated}
                onRequireLogin={requestLogin}
              />
            ))}

            {displayedTracked.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
                {locale === "fr"
                  ? "Aucune livraison suivie pour le moment."
                  : "No tracked deliveries yet."}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
