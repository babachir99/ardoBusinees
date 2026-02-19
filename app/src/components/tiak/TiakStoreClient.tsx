"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import TiakCreateDeliveryForm from "@/components/tiak/TiakCreateDeliveryForm";
import TiakCourierAvailabilityPanel from "@/components/tiak/TiakCourierAvailabilityPanel";
import TiakDeliveryCard from "@/components/tiak/TiakDeliveryCard";
import { type TiakCourierProfile, type TiakDelivery } from "@/components/tiak/types";

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

  const [couriers, setCouriers] = useState<TiakCourierProfile[]>([]);
  const [couriersLoading, setCouriersLoading] = useState(false);
  const [couriersError, setCouriersError] = useState<string | null>(null);

  const [myProfile, setMyProfile] = useState<TiakCourierProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileCities, setProfileCities] = useState("");
  const [profileAreas, setProfileAreas] = useState("");
  const [profileVehicleType, setProfileVehicleType] = useState("");
  const [profileMaxWeightKg, setProfileMaxWeightKg] = useState("");
  const [profileHours, setProfileHours] = useState("");
  const [profileIsActive, setProfileIsActive] = useState(true);

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

  const refreshCouriers = useCallback(async () => {
    setCouriersLoading(true);
    setCouriersError(null);

    try {
      const response = await fetch("/api/tiak-tiak/couriers", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setCouriersError(typeof data?.error === "string" ? data.error : "Unable to load couriers");
        return;
      }

      setCouriers(Array.isArray(data) ? (data as TiakCourierProfile[]) : []);
    } catch {
      setCouriersError("Unable to load couriers");
    } finally {
      setCouriersLoading(false);
    }
  }, []);

  const refreshMyProfile = useCallback(async () => {
    if (!isCourierOrAdmin || !isLoggedIn) {
      setMyProfile(null);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      const response = await fetch("/api/tiak-tiak/couriers/me", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403) {
          setProfileError(
            locale === "fr"
              ? "Profil courier reserve aux comptes COURIER/ADMIN."
              : "Courier profile is available for COURIER/ADMIN accounts only."
          );
          return;
        }
        setProfileError(typeof data?.error === "string" ? data.error : "Unable to load profile");
        return;
      }

      const profile = (data ?? null) as TiakCourierProfile | null;
      setMyProfile(profile);

      if (profile) {
        setProfileCities(profile.cities.join(", "));
        setProfileAreas(profile.areas.join(", "));
        setProfileVehicleType(profile.vehicleType ?? "");
        setProfileMaxWeightKg(profile.maxWeightKg ? String(profile.maxWeightKg) : "");
        setProfileHours(profile.availableHours ?? "");
        setProfileIsActive(profile.isActive);
      }
    } catch {
      setProfileError("Unable to load profile");
    } finally {
      setProfileLoading(false);
    }
  }, [isCourierOrAdmin, isLoggedIn]);

  useEffect(() => {
    refreshOpenDeliveries();
  }, [refreshOpenDeliveries]);

  useEffect(() => {
    refreshTrackedDeliveries();
  }, [refreshTrackedDeliveries]);

  useEffect(() => {
    refreshCouriers();
  }, [refreshCouriers]);

  useEffect(() => {
    refreshMyProfile();
  }, [refreshMyProfile]);

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

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isCourierOrAdmin) {
      setProfileError("Forbidden");
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);

    const cities = profileCities
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const areas = profileAreas
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/tiak-tiak/couriers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: profileIsActive,
          cities,
          areas,
          vehicleType: profileVehicleType || null,
          maxWeightKg: profileMaxWeightKg ? Number(profileMaxWeightKg) : null,
          availableHours: profileHours || null,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403) {
          setProfileError(
            locale === "fr"
              ? "KYC requis: complete ton KYC courier avant de publier ton profil."
              : "KYC required: complete courier KYC before publishing your profile."
          );
          return;
        }
        setProfileError(typeof data?.error === "string" ? data.error : "Unable to save profile");
        return;
      }

      const profile = data as TiakCourierProfile;
      setMyProfile(profile);
      setProfileSuccess(locale === "fr" ? "Profil mis a jour" : "Profile updated");
      await refreshCouriers();
    } catch {
      setProfileError("Unable to save profile");
    } finally {
      setProfileLoading(false);
    }
  }

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

      <TiakCourierAvailabilityPanel
        locale={locale}
        isLoggedIn={isLoggedIn}
        currentUserRole={currentUserRole}
        onRequireLogin={requestLogin}
      />

      {isCourierOrAdmin && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <h2 className="text-lg font-semibold text-white">{locale === "fr" ? "Espace livreur" : "Courier space"}</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSaveProfile}>
            <label className="flex flex-col gap-1 text-xs text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Villes (separees par virgules)" : "Cities (comma separated)"}
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={profileCities} onChange={(event) => setProfileCities(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Zones (separees par virgules)" : "Areas (comma separated)"}
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={profileAreas} onChange={(event) => setProfileAreas(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Vehicule" : "Vehicle"}
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={profileVehicleType} onChange={(event) => setProfileVehicleType(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              {locale === "fr" ? "Poids max (kg)" : "Max weight (kg)"}
              <input type="number" min={1} className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={profileMaxWeightKg} onChange={(event) => setProfileMaxWeightKg(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Horaires" : "Available hours"}
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={profileHours} onChange={(event) => setProfileHours(event.target.value)} />
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 md:col-span-2">
              <input type="checkbox" checked={profileIsActive} onChange={(event) => setProfileIsActive(event.target.checked)} />
              {locale === "fr" ? "Profil actif" : "Profile active"}
            </label>
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" disabled={profileLoading} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                {profileLoading ? (locale === "fr" ? "Envoi..." : "Saving...") : locale === "fr" ? "Enregistrer" : "Save"}
              </button>
              {profileError && <p className="text-sm text-rose-300">{profileError}</p>}
              {profileSuccess && <p className="text-sm text-emerald-300">{profileSuccess}</p>}
            </div>
          </form>
          {myProfile && (
            <p className="mt-3 text-xs text-zinc-400">
              {locale === "fr" ? "Derniere mise a jour" : "Last update"}: {new Date(myProfile.updatedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {locale === "fr" ? "Coursiers disponibles" : "Available couriers"}
          </h2>
          <button
            type="button"
            onClick={refreshCouriers}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
          >
            {locale === "fr" ? "Rafraichir" : "Refresh"}
          </button>
        </div>

        {couriersLoading && <p className="text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
        {couriersError && <p className="text-sm text-rose-300">{couriersError}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {couriers.map((profile) => (
            <article key={profile.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
              <p className="text-sm font-semibold text-white">{profile.courier.name ?? "Courier"}</p>
              <p className="mt-1 text-xs text-zinc-400">{profile.vehicleType ?? "-"}</p>
              <p className="mt-2 text-xs text-zinc-300">Cities: {profile.cities.length ? profile.cities.join(", ") : "-"}</p>
              <p className="mt-1 text-xs text-zinc-300">Areas: {profile.areas.length ? profile.areas.join(", ") : "-"}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {locale === "fr" ? "Mise a jour" : "Updated"}: {new Date(profile.updatedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
              </p>
            </article>
          ))}

          {!couriersLoading && couriers.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              {locale === "fr" ? "Aucun courier actif." : "No active courier profile."}
            </div>
          )}
        </div>
      </section>

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
