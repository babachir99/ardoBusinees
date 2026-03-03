"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import TiakCreateDeliveryForm from "@/components/tiak/TiakCreateDeliveryForm";
import TiakCourierAvailabilityPanel from "@/components/tiak/TiakCourierAvailabilityPanel";
import TiakDeliveryQueue from "@/components/tiak/TiakDeliveryQueue";
import TiakDeliveryDetailsPanel from "@/components/tiak/TiakDeliveryDetailsPanel";
import UserProfileDrawer from "@/components/trust/UserProfileDrawer";
import { type TiakCourierProfile, type TiakDelivery, type TiakPayout } from "@/components/tiak/types";

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

function formatAmount(value: number, currency: string) {
  if (!Number.isFinite(value)) return "-";
  if (currency === "XOF") return `${value} FCFA`;
  return `${value} ${currency}`;
}

function formatDateLabel(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

type TiakActivityLog = {
  id: string;
  action: string;
  entityId: string | null;
  createdAt: string;
};

function formatTiakActivityAction(action: string, locale: string) {
  const frMap: Record<string, string> = {
    TIAK_JOB_ASSIGNED: "Mission assignee au coursier",
    TIAK_AUTO_ASSIGNED: "Auto-assignation effectuee",
    TIAK_DELIVERY_ASSIGNED: "Course assignee",
    TIAK_DELIVERY_ACCEPTED: "Course acceptee",
    TIAK_DELIVERY_DECLINED: "Course refusee",
    TIAK_DELIVERY_PICKED_UP: "Colis recupere",
    TIAK_DELIVERY_DELIVERED: "Livraison effectuee",
    TIAK_DELIVERY_COMPLETED: "Livraison confirmee",
    TIAK_DELIVERY_CANCELED: "Livraison annulee",
    TIAK_DELIVERY_REJECTED: "Assignation rejetee",
  };

  const enMap: Record<string, string> = {
    TIAK_JOB_ASSIGNED: "Courier assignment created",
    TIAK_AUTO_ASSIGNED: "Auto-assignment completed",
    TIAK_DELIVERY_ASSIGNED: "Delivery assigned",
    TIAK_DELIVERY_ACCEPTED: "Delivery accepted",
    TIAK_DELIVERY_DECLINED: "Delivery declined",
    TIAK_DELIVERY_PICKED_UP: "Parcel picked up",
    TIAK_DELIVERY_DELIVERED: "Delivery completed",
    TIAK_DELIVERY_COMPLETED: "Delivery confirmed",
    TIAK_DELIVERY_CANCELED: "Delivery canceled",
    TIAK_DELIVERY_REJECTED: "Assignment rejected",
  };

  return locale === "fr" ? (frMap[action] ?? action) : (enMap[action] ?? action);
}

export default function TiakStoreClient({ locale, isLoggedIn, currentUserId, currentUserRole }: Props) {
  const [openDeliveries, setOpenDeliveries] = useState<TiakDelivery[]>([]);
  const [trackedDeliveries, setTrackedDeliveries] = useState<TiakDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couriers, setCouriers] = useState<TiakCourierProfile[]>([]);
  const [couriersLoading, setCouriersLoading] = useState(false);
  const [couriersError, setCouriersError] = useState<string | null>(null);
  const [selectedCourierProfile, setSelectedCourierProfile] = useState<TiakCourierProfile | null>(null);
  const [courierSearch, setCourierSearch] = useState("");
  const [couriersAvailableOnly, setCouriersAvailableOnly] = useState(true);
  const [couriersVisibleCount, setCouriersVisibleCount] = useState(6);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

  const [selectedDelivery, setSelectedDelivery] = useState<TiakDelivery | null>(null);
  const [courierSpaceOpen, setCourierSpaceOpen] = useState(false);
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [openNewMission, setOpenNewMission] = useState(false);
  const [myDeliveriesView, setMyDeliveriesView] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

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

  const [payouts, setPayouts] = useState<TiakPayout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutsMeta, setPayoutsMeta] = useState<{ count: number; sumCourierPayoutCents: number } | null>(null);

  const [tiakNotifications, setTiakNotifications] = useState<TiakActivityLog[]>([]);
  const [tiakNotificationsLoading, setTiakNotificationsLoading] = useState(false);
  const [tiakNotificationsError, setTiakNotificationsError] = useState<string | null>(null);
  const [tiakNotificationsReadAt, setTiakNotificationsReadAt] = useState<string | null>(null);

  const storageKey = getStoreKey(currentUserId);
  const notificationsReadKey = currentUserId ? `tiak-notifications-read:${currentUserId}` : null;

  const isAdmin = currentUserRole === "ADMIN";
  const isCourierOrAdmin = currentUserRole === "COURIER" || currentUserRole === "ADMIN";
  const isConfirmedCourier = isAdmin || Boolean(myProfile?.isConfirmedCourier);
  const canViewEarnings = isLoggedIn && isConfirmedCourier;

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

    try {
      const response = await fetch("/api/tiak-tiak/deliveries?mine=1&take=80", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setTrackedDeliveries([]);
        return;
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data) ? (data as TiakDelivery[]) : [];
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setTrackedDeliveries(list);

      const trackedIds = list.map((entry) => entry.id);
      writeStoredIds(storageKey, trackedIds);
    } catch {
      setTrackedDeliveries([]);
    }
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

  const refreshPayouts = useCallback(async () => {
    if (!canViewEarnings) {
      setPayouts([]);
      setPayoutsMeta(null);
      return;
    }

    setPayoutsLoading(true);
    setPayoutsError(null);

    try {
      const response = await fetch("/api/tiak/payouts?mine=1&take=60", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403) {
          setPayoutsError(locale === "fr" ? "Acces reserve aux coursiers." : "Access restricted to couriers.");
          return;
        }
        if (response.status === 401) {
          setPayoutsError(locale === "fr" ? "Connecte-toi pour voir tes gains." : "Sign in to view your earnings.");
          return;
        }
        setPayoutsError(typeof data?.message === "string" ? data.message : "Unable to load payouts");
        return;
      }

      const payoutsList = Array.isArray(data?.payouts) ? (data.payouts as TiakPayout[]) : [];
      setPayouts(payoutsList);
      setPayoutsMeta(
        data && typeof data === "object" && data.meta && typeof data.meta === "object"
          ? {
              count: Number((data.meta as { count?: unknown }).count ?? payoutsList.length) || 0,
              sumCourierPayoutCents:
                Number((data.meta as { sumCourierPayoutCents?: unknown }).sumCourierPayoutCents ?? 0) || 0,
            }
          : { count: payoutsList.length, sumCourierPayoutCents: 0 }
      );
    } catch {
      setPayoutsError("Unable to load payouts");
    } finally {
      setPayoutsLoading(false);
    }
  }, [canViewEarnings, locale]);

  const refreshTiakNotifications = useCallback(async () => {
    if (!isLoggedIn || !currentUserId) {
      setTiakNotifications([]);
      setTiakNotificationsError(null);
      return;
    }

    setTiakNotificationsLoading(true);
    setTiakNotificationsError(null);

    try {
      const response = await fetch("/api/activity", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setTiakNotificationsError(locale === "fr" ? "Notifications indisponibles." : "Notifications unavailable.");
        return;
      }

      const allLogs = Array.isArray(data) ? (data as Array<{ id?: unknown; action?: unknown; entityId?: unknown; createdAt?: unknown }>) : [];
      const tiakLogs: TiakActivityLog[] = allLogs
        .filter((item) => typeof item.action === "string" && item.action.startsWith("TIAK_"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "",
          action: String(item.action ?? ""),
          entityId: typeof item.entityId === "string" ? item.entityId : null,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
        }))
        .filter((item) => item.id.length > 0)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);

      setTiakNotifications(tiakLogs);
    } catch {
      setTiakNotificationsError(locale === "fr" ? "Notifications indisponibles." : "Notifications unavailable.");
    } finally {
      setTiakNotificationsLoading(false);
    }
  }, [currentUserId, isLoggedIn, locale]);

  const markTiakNotificationsRead = useCallback(() => {
    if (!notificationsReadKey || typeof window === "undefined") return;
    const now = new Date().toISOString();
    window.localStorage.setItem(notificationsReadKey, now);
    setTiakNotificationsReadAt(now);
  }, [notificationsReadKey]);

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

  useEffect(() => {
    refreshPayouts();
  }, [refreshPayouts]);

  useEffect(() => {
    if (!notificationsReadKey || typeof window === "undefined") {
      setTiakNotificationsReadAt(null);
      return;
    }

    const stored = window.localStorage.getItem(notificationsReadKey);
    setTiakNotificationsReadAt(stored);
  }, [notificationsReadKey]);

  useEffect(() => {
    refreshTiakNotifications();
  }, [refreshTiakNotifications]);

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
    setOpenNewMission(false);
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

  const archivedStatuses = useMemo(
    () => new Set<TiakDelivery["status"]>(["COMPLETED", "CANCELED", "REJECTED"]),
    []
  );

  const activeTrackedDeliveries = useMemo(
    () => displayedTracked.filter((entry) => !archivedStatuses.has(entry.status)),
    [archivedStatuses, displayedTracked]
  );

  const archivedTrackedDeliveries = useMemo(
    () => displayedTracked.filter((entry) => archivedStatuses.has(entry.status)),
    [archivedStatuses, displayedTracked]
  );

  const trackedDeliveriesToShow = myDeliveriesView === "ARCHIVED" ? archivedTrackedDeliveries : activeTrackedDeliveries;

  const unreadTiakNotificationsCount = useMemo(() => {
    if (!isLoggedIn) return 0;
    if (!tiakNotificationsReadAt) return tiakNotifications.length;

    const readAt = new Date(tiakNotificationsReadAt).getTime();
    if (Number.isNaN(readAt)) return tiakNotifications.length;

    return tiakNotifications.filter((entry) => {
      const createdAt = new Date(entry.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt > readAt;
    }).length;
  }, [isLoggedIn, tiakNotifications, tiakNotificationsReadAt]);

  const latestTiakNotifications = useMemo(() => tiakNotifications.slice(0, 8), [tiakNotifications]);

  const filteredCouriers = useMemo(() => {
    const query = courierSearch.trim().toLowerCase();
    return couriers.filter((profile) => {
      if (couriersAvailableOnly && !profile.isActive) return false;
      if (!query) return true;

      const haystack = [
        profile.courier.name ?? "",
        profile.vehicleType ?? "",
        ...profile.cities,
        ...profile.areas,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [courierSearch, couriers, couriersAvailableOnly]);

  const visibleCouriers = useMemo(
    () => filteredCouriers.slice(0, couriersVisibleCount),
    [couriersVisibleCount, filteredCouriers]
  );

  const hasMoreCouriers = filteredCouriers.length > couriersVisibleCount;
  const availableCourierCount = useMemo(
    () => couriers.filter((profile) => profile.isActive).length,
    [couriers]
  );
  const isFilterActive = courierSearch.trim().length > 0 || !couriersAvailableOnly;

  const inProgressCount = useMemo(
    () =>
      displayedTracked.filter(
        (delivery) =>
          delivery.status === "ASSIGNED" ||
          delivery.status === "ACCEPTED" ||
          delivery.status === "PICKED_UP" ||
          delivery.status === "DELIVERED"
      ).length,
    [displayedTracked]
  );

  const monthlyGainCents = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return payouts.reduce((sum, payout) => {
      const createdAt = new Date(payout.createdAt);
      if (Number.isNaN(createdAt.getTime())) return sum;
      if (createdAt.getMonth() !== month || createdAt.getFullYear() !== year) return sum;
      return sum + payout.courierPayoutCents;
    }, 0);
  }, [payouts]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshOpenDeliveries(),
      refreshTrackedDeliveries(),
      refreshCouriers(),
      refreshMyProfile(),
      refreshPayouts(),
      refreshTiakNotifications(),
    ]);
  }, [refreshCouriers, refreshMyProfile, refreshOpenDeliveries, refreshPayouts, refreshTiakNotifications, refreshTrackedDeliveries]);

  const openDeliveryPanel = useCallback(
    (delivery: TiakDelivery) => {
      trackDeliveryId(delivery.id);
      setSelectedDelivery(delivery);
    },
    [trackDeliveryId]
  );

  useEffect(() => {
    if (!selectedDelivery?.id) return;
    const latest = [...openDeliveries, ...trackedDeliveries].find(
      (entry) => entry.id === selectedDelivery.id
    );
    if (!latest) return;
    if (latest.updatedAt !== selectedDelivery.updatedAt) {
      setSelectedDelivery(latest);
    }
  }, [openDeliveries, selectedDelivery?.id, selectedDelivery?.updatedAt, trackedDeliveries]);

  useEffect(() => {
    if (!openNewMission) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenNewMission(false);
      }
    };

    document.body.classList.add("overflow-hidden");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openNewMission]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {locale === "fr" ? "Livraison locale express" : "Local express delivery"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {locale === "fr"
                ? "Cree une demande, trouve un coursier et pilote les preuves en un flux simple."
                : "Create a request, find a courier and manage proofs in a single flow."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
            >
              {locale === "fr" ? "Rafraichir" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("tiak-my-deliveries")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/65"
            >
              {locale === "fr" ? "Voir historique" : "View history"}
            </button>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById("tiak-notifications")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  markTiakNotificationsRead();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
              >
                {locale === "fr" ? "Notifications" : "Notifications"}
                {unreadTiakNotificationsCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadTiakNotificationsCount > 99 ? "99+" : unreadTiakNotificationsCount}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-200">
            {locale === "fr" ? "Demandes ouvertes" : "Open requests"}: {openDeliveries.length}
          </span>
          <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
            {locale === "fr" ? "Livraisons en cours" : "In progress"}: {inProgressCount}
          </span>
          {canViewEarnings ? (
            <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              {locale === "fr" ? "Gains (mois)" : "Earnings (month)"}: {formatAmount(monthlyGainCents, "XOF")}
            </span>
          ) : null}
        </div>
      </section>

      <section className="sticky top-20 z-30 rounded-2xl border border-neutral-800/70 bg-neutral-900/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur transition-colors duration-200 ease-out hover:border-emerald-400/25 hover:bg-neutral-900/70 motion-reduce:transition-none">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {locale === "fr" ? "Dispatch livraison" : "Delivery dispatch"}
              </h3>
              <p className="mt-1 text-sm text-neutral-400">
                {locale === "fr"
                  ? "Cree une livraison et assigne un livreur en quelques secondes."
                  : "Create a delivery and assign a courier in seconds."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-3 py-1 text-xs text-neutral-200">
                {locale === "fr" ? "Demandes" : "Requests"}: {openDeliveries.length}
              </span>
              <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-3 py-1 text-xs text-neutral-200">
                {locale === "fr" ? "En cours" : "In progress"}: {inProgressCount}
              </span>
              <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-3 py-1 text-xs text-neutral-200">
                {locale === "fr" ? "Livreurs" : "Couriers"}: {availableCourierCount}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenNewMission(true)}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-2.5 font-medium text-neutral-950 shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition-all duration-200 ease-out hover:brightness-110 hover:shadow-[0_14px_36px_rgba(16,185,129,0.35)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400/50 motion-reduce:transition-none"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
            <span>{locale === "fr" ? "Demarrer une livraison" : "Start a delivery"}</span>
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="space-y-3">
            {loading && <p className="text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <TiakDeliveryQueue
              id="tiak-open-deliveries"
              locale={locale}
              title={locale === "fr" ? "Demandes ouvertes" : "Open requests"}
              subtitle={
                locale === "fr"
                  ? "File operationnelle: ouvre une ligne pour traiter preuves, statut et assignation."
                  : "Operational queue: open a row to process proof, status and assignment."
              }
              deliveries={openDeliveries}
              emptyLabel={locale === "fr" ? "Aucune demande ouverte." : "No open requests."}
              actionLabel={locale === "fr" ? "Traiter" : "Process"}
              onOpenDelivery={openDeliveryPanel}
            />
          </section>

          {isLoggedIn ? (
            <section id="tiak-notifications" className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {locale === "fr" ? "Notifications TIAK" : "TIAK notifications"}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    {locale === "fr"
                      ? "Suivi interne des assignations et statuts de livraison."
                      : "Internal feed for assignments and delivery status updates."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadTiakNotificationsCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-rose-300/35 bg-rose-300/10 px-2 py-0.5 text-[11px] font-medium text-rose-100">
                      {locale === "fr" ? "Non lues" : "Unread"}: {unreadTiakNotificationsCount}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void refreshTiakNotifications()}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
                  >
                    {locale === "fr" ? "Rafraichir" : "Refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={markTiakNotificationsRead}
                    className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60"
                  >
                    {locale === "fr" ? "Marquer lu" : "Mark read"}
                  </button>
                </div>
              </div>

              {tiakNotificationsLoading ? (
                <p className="text-xs text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>
              ) : null}

              {tiakNotificationsError ? (
                <p className="text-xs text-rose-300">{tiakNotificationsError}</p>
              ) : null}

              {!tiakNotificationsLoading && !tiakNotificationsError ? (
                <div className="space-y-2">
                  {latestTiakNotifications.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {locale === "fr" ? "Aucune notification TIAK." : "No TIAK notifications."}
                    </p>
                  ) : (
                    latestTiakNotifications.map((entry) => {
                      const isUnread =
                        !tiakNotificationsReadAt ||
                        new Date(entry.createdAt).getTime() > new Date(tiakNotificationsReadAt).getTime();

                      return (
                        <div
                          key={entry.id}
                          className={`rounded-xl border px-3 py-2 text-xs transition ${isUnread ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-zinc-950/60 text-zinc-200"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{formatTiakActivityAction(entry.action, locale)}</p>
                            {entry.entityId ? (
                              <span className="text-[10px] text-zinc-400">#{entry.entityId.slice(0, 8)}</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {new Date(entry.createdAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {isLoggedIn && (
            <section id="tiak-my-deliveries" className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-zinc-950/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMyDeliveriesView("ACTIVE")}
                  className={`rounded-full px-3 py-1 font-medium transition ${myDeliveriesView === "ACTIVE" ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"}`}
                >
                  {locale === "fr" ? "En cours" : "Active"} ({activeTrackedDeliveries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMyDeliveriesView("ARCHIVED")}
                  className={`rounded-full px-3 py-1 font-medium transition ${myDeliveriesView === "ARCHIVED" ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"}`}
                >
                  {locale === "fr" ? "Archivees" : "Archived"} ({archivedTrackedDeliveries.length})
                </button>
              </div>

              <TiakDeliveryQueue
                locale={locale}
                title={
                  isCourierOrAdmin
                    ? locale === "fr"
                      ? "Mes livraisons"
                      : "My deliveries"
                    : locale === "fr"
                      ? "Mes demandes"
                      : "My requests"
                }
                subtitle={
                  myDeliveriesView === "ARCHIVED"
                    ? locale === "fr"
                      ? "Archive des missions traitees, retrouvable a tout moment."
                      : "Archive of completed missions, always retrievable."
                    : locale === "fr"
                      ? "Historique compact avec ouverture des actions dans le panneau details."
                      : "Compact history with actions opened in the details panel."
                }
                deliveries={trackedDeliveriesToShow}
                emptyLabel={
                  myDeliveriesView === "ARCHIVED"
                    ? locale === "fr"
                      ? "Aucune mission archivee."
                      : "No archived missions."
                    : locale === "fr"
                      ? "Aucune livraison suivie pour le moment."
                      : "No tracked deliveries yet."
                }
                actionLabel={locale === "fr" ? "Voir" : "View"}
                onOpenDelivery={openDeliveryPanel}
              />
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {locale === "fr" ? "Trouver un livreur" : "Find a courier"}
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100">
                    {locale === "fr"
                      ? `${availableCourierCount} disponibles`
                      : `${availableCourierCount} available`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {locale === "fr"
                    ? "Matching rapide par ville/zone puis action immediate."
                    : "Fast matching by city/area then immediate action."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshCouriers()}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
              >
                {locale === "fr" ? "Rafraichir" : "Refresh"}
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  value={courierSearch}
                  onChange={(event) => {
                    setCourierSearch(event.target.value);
                    setCouriersVisibleCount(6);
                  }}
                  placeholder={locale === "fr" ? "Rechercher: ville, zone, vehicule..." : "Search: city, area, vehicle..."}
                  className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950/70 pl-9 pr-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/30"
                />
              </div>
              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/50 px-3 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={couriersAvailableOnly}
                  onChange={(event) => setCouriersAvailableOnly(event.target.checked)}
                />
                {locale === "fr" ? "Disponible uniquement" : "Available only"}
              </label>
              {isFilterActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setCourierSearch("");
                    setCouriersAvailableOnly(true);
                    setCouriersVisibleCount(6);
                  }}
                  className="h-10 rounded-xl border border-white/20 px-3 text-xs font-semibold text-zinc-200 transition hover:border-white/45"
                >
                  {locale === "fr" ? "Reset" : "Reset"}
                </button>
              ) : (
                <div className="hidden h-10 md:block" />
              )}
            </div>

            {couriersLoading && <p className="mt-3 text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
            {couriersError && <p className="mt-3 text-sm text-rose-300">{couriersError}</p>}

            <div className="mt-2 text-[11px] text-zinc-500">
              {locale === "fr"
                ? `${filteredCouriers.length} profils affiches`
                : `${filteredCouriers.length} profiles shown`}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              {visibleCouriers.map((profile) => {
                const isSelected = selectedCourierId === profile.id;
                const cityChips = profile.cities.slice(0, 2);
                const areaChips = profile.areas.slice(0, 2);
                const extraCities = Math.max(0, profile.cities.length - cityChips.length);
                const extraAreas = Math.max(0, profile.areas.length - areaChips.length);

                return (
                  <article
                    key={profile.id}
                    className={`group flex h-full flex-col rounded-xl border p-3 transition-all duration-200 ease-out motion-reduce:transition-none ${
                      isSelected
                        ? "border-emerald-300/55 bg-emerald-300/10 ring-2 ring-emerald-300/60"
                        : "border-white/10 bg-zinc-900/65 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:shadow-[0_10px_20px_rgba(0,0,0,0.25)] motion-reduce:hover:translate-y-0"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {profile.courier.image ? (
                          <img
                            src={profile.courier.image}
                            alt={profile.courier.name ?? "Courier"}
                            className="h-10 w-10 rounded-full border border-white/15 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-800 text-sm font-semibold text-zinc-200">
                            {(profile.courier.name ?? "C").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-100">
                            {profile.courier.name ?? (locale === "fr" ? "Coursier" : "Courier")}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="inline-flex rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-200">
                              {locale === "fr" ? "Coursier" : "Courier"}
                            </span>
                            <span className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-100 transition-colors group-hover:border-cyan-300/55">
                              {locale === "fr" ? "Fiabilite" : "Reliability"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCourierProfile(profile)}
                        className="rounded-full border border-white/15 p-1.5 text-zinc-300 transition hover:border-white/40 hover:text-white"
                        aria-label={locale === "fr" ? "Plus d'actions" : "More actions"}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                          <circle cx="5" cy="12" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-3 space-y-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-zinc-500">{locale === "fr" ? "Vehicule" : "Vehicle"}</span>
                        <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-emerald-100">
                          {profile.vehicleType ?? (locale === "fr" ? "Non renseigne" : "Not set")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-zinc-500">{locale === "fr" ? "Villes" : "Cities"}</span>
                        {cityChips.length > 0 ? cityChips.map((city) => (
                          <span key={`${profile.id}-city-${city}`} className="inline-flex rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5 text-zinc-200">
                            {city}
                          </span>
                        )) : (
                          <span className="text-zinc-400">-</span>
                        )}
                        {extraCities > 0 ? (
                          <span className="inline-flex rounded-full border border-white/10 bg-zinc-900 px-2 py-0.5 text-zinc-400">+{extraCities}</span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-zinc-500">{locale === "fr" ? "Zones" : "Areas"}</span>
                        {areaChips.length > 0 ? areaChips.map((area) => (
                          <span key={`${profile.id}-area-${area}`} className="inline-flex rounded-full border border-white/15 bg-zinc-950/70 px-2 py-0.5 text-zinc-200">
                            {area}
                          </span>
                        )) : (
                          <span className="text-zinc-400">-</span>
                        )}
                        {extraAreas > 0 ? (
                          <span className="inline-flex rounded-full border border-white/10 bg-zinc-900 px-2 py-0.5 text-zinc-400">+{extraAreas}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-300/15 px-2 py-1 text-[11px] font-medium text-emerald-100">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3" aria-hidden="true">
                            <path d="m5 13 4 4L19 7" />
                          </svg>
                          {locale === "fr" ? "Selectionne" : "Selected"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">&nbsp;</span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedCourierId(profile.id);
                        }}
                        className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-105"
                      >
                        {isSelected
                          ? locale === "fr"
                            ? "Assigner"
                            : "Assign"
                          : locale === "fr"
                            ? "Selectionner"
                            : "Select"}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedCourierProfile(profile);
                        }}
                        className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
                      >
                        {locale === "fr" ? "Voir profil" : "View profile"}
                      </button>
                    </div>
                  </article>
                );
              })}

              {!couriersLoading && filteredCouriers.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                  {locale === "fr" ? "Aucun coursier disponible avec ces filtres." : "No couriers with current filters."}
                </div>
              )}
            </div>

            {hasMoreCouriers ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCouriersVisibleCount((count) => count + 6)}
                  className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
                >
                  {locale === "fr" ? "Afficher plus" : "Show more"}
                </button>
              </div>
            ) : null}
          </section>

          {isCourierOrAdmin && isLoggedIn ? (
            <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <button
                type="button"
                onClick={() => setCourierSpaceOpen((open) => !open)}
                aria-expanded={courierSpaceOpen}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/45 px-3 py-2 text-left transition hover:border-white/20"
              >
                <div>
                  <h3 className="text-base font-semibold text-white">{locale === "fr" ? "Espace livreur" : "Courier space"}</h3>
                  <p className="mt-1 text-xs text-zinc-400">{locale === "fr" ? "Profil, zones et disponibilite" : "Profile, zones and availability"}</p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${courierSpaceOpen ? "rotate-180" : "rotate-0"}`}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {courierSpaceOpen ? (
                <div className="mt-4 space-y-4">
                  <TiakCourierAvailabilityPanel
                    locale={locale}
                    isLoggedIn={isLoggedIn}
                    currentUserRole={currentUserRole}
                    onRequireLogin={requestLogin}
                  />

                  <form className="grid gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4 md:grid-cols-2" onSubmit={handleSaveProfile}>
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
                    <p className="text-xs text-zinc-500">
                      {locale === "fr" ? "Derniere mise a jour" : "Last update"}: {new Date(myProfile.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {isCourierOrAdmin && isLoggedIn ? (
            canViewEarnings ? (
              <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                <button
                  type="button"
                  onClick={() => setEarningsOpen((open) => !open)}
                  aria-expanded={earningsOpen}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/45 px-3 py-2 text-left transition hover:border-white/20"
                >
                  <div>
                    <h3 className="text-base font-semibold text-white">{locale === "fr" ? "Mes gains" : "My earnings"}</h3>
                    <p className="mt-1 text-xs text-zinc-400">
                      {locale === "fr" ? "Resume net + paiements" : "Net summary + payouts"}
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-4 w-4 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${earningsOpen ? "rotate-180" : "rotate-0"}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {earningsOpen ? (
                  <div className="mt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      {payoutsMeta ? (
                        <p className="text-xs text-zinc-300">
                          {locale === "fr" ? "Total net" : "Total net"}: {formatAmount(payoutsMeta.sumCourierPayoutCents, "XOF")}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void refreshPayouts()}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-zinc-100 transition hover:border-white/45"
                      >
                        {locale === "fr" ? "Rafraichir" : "Refresh"}
                      </button>
                    </div>

                    {payoutsLoading && <p className="text-sm text-zinc-300">{locale === "fr" ? "Chargement..." : "Loading..."}</p>}
                    {payoutsError && <p className="text-sm text-rose-300">{payoutsError}</p>}

                    {!payoutsLoading && !payoutsError ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs text-zinc-200">
                          <thead className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                            <tr>
                              <th className="py-2 pr-4">{locale === "fr" ? "Date" : "Date"}</th>
                              <th className="py-2 pr-4">{locale === "fr" ? "Total" : "Total"}</th>
                              <th className="py-2 pr-4">Fee</th>
                              <th className="py-2 pr-4">{locale === "fr" ? "Net" : "Net"}</th>
                              <th className="py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payouts.map((payout) => (
                              <tr key={payout.id} className="border-t border-white/10">
                                <td className="py-2 pr-4">{formatDateLabel(payout.createdAt, locale)}</td>
                                <td className="py-2 pr-4">{formatAmount(payout.amountTotalCents, payout.currency)}</td>
                                <td className="py-2 pr-4">{formatAmount(payout.platformFeeCents, payout.currency)}</td>
                                <td className="py-2 pr-4 text-emerald-300">{formatAmount(payout.courierPayoutCents, payout.currency)}</td>
                                <td className="py-2">{payout.status}</td>
                              </tr>
                            ))}
                            {payouts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-4 text-zinc-400">
                                  {locale === "fr" ? "Aucun payout." : "No payouts."}
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                {locale === "fr"
                  ? "Tes gains seront visibles apres validation de ton KYC coursier."
                  : "Your earnings will be visible once your courier KYC is approved."}
              </section>
            )
          ) : null}
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-50 ${openNewMission ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!openNewMission}
      >
        <div
          className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none ${openNewMission ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpenNewMission(false)}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={locale === "fr" ? "Creer une demande" : "Create a request"}
          className={`absolute inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-[0_-20px_50px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out motion-reduce:transition-none lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-[520px] lg:max-w-[92vw] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 ${openNewMission ? "translate-y-0 opacity-100 lg:translate-x-0" : "translate-y-full opacity-0 lg:translate-x-full"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                {locale === "fr" ? "Creer une demande" : "Create request"}
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                {locale === "fr" ? "Mission locale, assignation rapide" : "Local mission, fast assignment"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenNewMission(false)}
              className="rounded-full border border-white/15 p-2 text-zinc-300 transition hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
              aria-label={locale === "fr" ? "Fermer" : "Close"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="h-[calc(90vh-84px)] overflow-y-auto p-4 lg:h-[calc(100%-84px)]">
            <TiakCreateDeliveryForm locale={locale} isLoggedIn={isLoggedIn} onCreated={handleCreated} />
          </div>
        </div>
      </div>

      <UserProfileDrawer
        open={Boolean(selectedCourierProfile)}
        onClose={() => setSelectedCourierProfile(null)}
        locale={locale}
        userId={selectedCourierProfile?.courierId}
        viewerUserId={currentUserId}
        name={selectedCourierProfile?.courier.name ?? (locale === "fr" ? "Coursier" : "Courier")}
        avatarUrl={selectedCourierProfile?.courier.image ?? null}
        roleLabel={locale === "fr" ? "Coursier" : "Courier"}
        reliabilityLabel={locale === "fr" ? "Fiabilite en progression" : "Reliability in progress"}
        details={
          selectedCourierProfile
            ? [
                {
                  label: locale === "fr" ? "Vehicule" : "Vehicle",
                  value: selectedCourierProfile.vehicleType ?? "-",
                },
                {
                  label: locale === "fr" ? "Villes" : "Cities",
                  value: selectedCourierProfile.cities.length
                    ? selectedCourierProfile.cities.join(", ")
                    : "-",
                },
                {
                  label: locale === "fr" ? "Zones" : "Areas",
                  value: selectedCourierProfile.areas.length
                    ? selectedCourierProfile.areas.join(", ")
                    : "-",
                },
                {
                  label: locale === "fr" ? "Horaires" : "Hours",
                  value: selectedCourierProfile.availableHours ?? "-",
                },
                {
                  label: locale === "fr" ? "Charge max" : "Max weight",
                  value:
                    typeof selectedCourierProfile.maxWeightKg === "number"
                      ? `${selectedCourierProfile.maxWeightKg} kg`
                      : "-",
                },
              ]
            : []
        }
        primaryAction={
          selectedCourierProfile && isLoggedIn && currentUserId !== selectedCourierProfile.courierId
            ? {
                label: locale === "fr" ? "Faire une demande" : "Create request",
                onClick: () => {
                  setSelectedCourierProfile(null);
                  setOpenNewMission(true);
                },
              }
            : undefined
        }
      />

      <TiakDeliveryDetailsPanel
        locale={locale}
        open={Boolean(selectedDelivery)}
        delivery={selectedDelivery}
        isLoggedIn={isLoggedIn}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onClose={() => setSelectedDelivery(null)}
        onTrackDelivery={trackDeliveryId}
        onDeliveryUpdated={handleDeliveryUpdated}
        onRequireLogin={requestLogin}
      />
    </div>
  );
}
