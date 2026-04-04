import { prisma } from "@/lib/prisma";
import {
  HOME_PROMO_AUDIENCES,
  HOME_PROMO_PLACEMENTS,
  type HomePromoAudience,
  type HomePromoEntry,
  type HomePromoPlacement,
} from "@/lib/homePromos.shared";

export const HOME_PROMO_ACTIVITY_ACTION = "ADMIN_HOME_PROMOS_UPDATED";
export const HOME_PROMO_TRACK_ACTIVITY_ACTION = "HOME_PROMO_TRACKED";
const MAX_HOME_PROMOS = 24;
const MAX_TRACK_LOGS = 4000;

export type HomePromoTrackingEventType = "IMPRESSION" | "CLICK" | "DISMISS";

export type HomePromoTrackingSummary = {
  totals: Record<HomePromoTrackingEventType, number>;
  anonymousTotals: Record<HomePromoTrackingEventType, number>;
  ctr: number;
  byPromoId: Record<
    string,
    {
      impressions: number;
      clicks: number;
      dismisses: number;
      anonymousImpressions: number;
      anonymousClicks: number;
      anonymousDismisses: number;
      ctr: number;
      placementBreakdown: Partial<Record<HomePromoPlacement, number>>;
      lastEventAt: string | null;
    }
  >;
};

const defaultHomePromos: HomePromoEntry[] = [
  {
    id: "cares",
    tag: "A la une",
    title: "JONTAADO CARES arrive en pre-prod",
    description:
      "Faire un don, lancer une cagnotte ou offrir un produit dans une experience plus claire.",
    href: "/stores/jontaado-cares",
    cta: "Decouvrir CARES",
    accentClassName: "from-emerald-400/22 via-emerald-500/8 to-zinc-950 border-emerald-300/20",
    advertiserName: "JONTAADO",
    advertiserLogoUrl: "/logo.png",
    imageUrl: "/stores/last_cares.png",
    placement: "HOME_POPUP",
    audience: "ALL",
    targetStoreSlugs: [],
    sponsoredLabel: "JONTAADO",
    openInNewTab: false,
    impressionCap: null,
    rotationSeconds: 6,
    priority: 100,
    enabled: true,
    startAt: null,
    endAt: null,
  },
  {
    id: "services",
    tag: "Opportunite",
    title: "Tiak et Presta accelerent",
    description:
      "Livraison express, besoins publies et services premium : les nouveaux flux sont prets.",
    href: "/stores/jontaado-presta",
    cta: "Voir les services",
    accentClassName: "from-amber-400/22 via-orange-500/8 to-zinc-950 border-amber-300/20",
    advertiserName: "JONTAADO",
    advertiserLogoUrl: "/logo.png",
    imageUrl: "/stores/presta.png",
    placement: "HOME_INLINE",
    audience: "ALL",
    targetStoreSlugs: [],
    sponsoredLabel: "JONTAADO",
    openInNewTab: false,
    impressionCap: null,
    rotationSeconds: 8,
    priority: 80,
    enabled: true,
    startAt: null,
    endAt: null,
  },
  {
    id: "sponsor-card-demo",
    tag: "Sponsorise",
    title: "Mettez votre marque dans le flux JONTAADO",
    description:
      "Format card premium, visuel propre et CTA direct pour des campagnes plus naturelles.",
    href: "/stores/jontaado-presta",
    cta: "Reserver ce format",
    accentClassName: "from-cyan-400/22 via-sky-500/8 to-zinc-950 border-cyan-300/20",
    advertiserName: "JONTAADO ADS",
    advertiserLogoUrl: "/logo.png",
    imageUrl: "/stores/presta.png",
    placement: "HOME_PRODUCT_CARD",
    audience: "ALL",
    targetStoreSlugs: [],
    sponsoredLabel: "Sponsorise",
    openInNewTab: false,
    impressionCap: null,
    rotationSeconds: 8,
    priority: 70,
    enabled: false,
    startAt: null,
    endAt: null,
  },
];

const accentOptions = new Set([
  "from-emerald-400/22 via-emerald-500/8 to-zinc-950 border-emerald-300/20",
  "from-amber-400/22 via-orange-500/8 to-zinc-950 border-amber-300/20",
  "from-cyan-400/22 via-sky-500/8 to-zinc-950 border-cyan-300/20",
  "from-rose-400/22 via-red-500/8 to-zinc-950 border-rose-300/20",
]);

function sanitizeText(value: unknown, fallback: string, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function sanitizeHref(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!(normalized.startsWith("/") || /^https?:\/\//i.test(normalized))) {
    return fallback;
  }
  return normalized.slice(0, 240);
}

function sanitizeOptionalAssetUrl(value: unknown, fallback: string | null) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (!(normalized.startsWith("/") || /^https?:\/\//i.test(normalized))) {
    return fallback;
  }

  return normalized.slice(0, 240);
}

function sanitizeAccent(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return accentOptions.has(normalized) ? normalized : fallback;
}

function sanitizeDateValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function sanitizePriority(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(999, Math.trunc(parsed)));
}

function sanitizePlacement(value: unknown, fallback: HomePromoPlacement): HomePromoPlacement {
  return HOME_PROMO_PLACEMENTS.includes(value as HomePromoPlacement)
    ? (value as HomePromoPlacement)
    : fallback;
}

function sanitizeAudience(value: unknown, fallback: HomePromoAudience): HomePromoAudience {
  return HOME_PROMO_AUDIENCES.includes(value as HomePromoAudience)
    ? (value as HomePromoAudience)
    : fallback;
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function sanitizeNullableCount(value: unknown, fallback: number | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.trunc(parsed);
  return normalized > 0 ? Math.min(normalized, 999) : null;
}

function sanitizeRotationSeconds(value: unknown, fallback: number | null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.trunc(parsed);
  return normalized >= 3 ? Math.min(normalized, 60) : fallback;
}

function buildPromoFallback(index: number): HomePromoEntry {
  const safeIndex = index + 1;
  return {
    id: `campaign-${safeIndex}`,
    tag: "Sponsorise",
    title: `Campagne ${safeIndex}`,
    description: "Nouvelle campagne sponsorisee JONTAADO.",
    href: "/shop",
    cta: "Voir plus",
    accentClassName: "from-emerald-400/22 via-emerald-500/8 to-zinc-950 border-emerald-300/20",
    advertiserName: "Annonceur",
    advertiserLogoUrl: null,
    imageUrl: null,
    placement: "HOME_PRODUCT_CARD",
    audience: "ALL",
    targetStoreSlugs: [],
    sponsoredLabel: "Sponsorise",
    openInNewTab: false,
    impressionCap: null,
    rotationSeconds: 8,
    priority: Math.max(0, 50 - index),
    enabled: false,
    startAt: null,
    endAt: null,
  };
}

function normalizePromo(entry: unknown, fallback: HomePromoEntry): HomePromoEntry {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return fallback;
  }

  const raw = entry as Record<string, unknown>;
  return {
    id: sanitizeText(raw.id, fallback.id, 40).toLowerCase().replace(/\s+/g, "-"),
    tag: sanitizeText(raw.tag, fallback.tag, 32),
    title: sanitizeText(raw.title, fallback.title, 90),
    description: sanitizeText(raw.description, fallback.description, 180),
    href: sanitizeHref(raw.href, fallback.href),
    cta: sanitizeText(raw.cta, fallback.cta, 40),
    accentClassName: sanitizeAccent(raw.accentClassName, fallback.accentClassName),
    advertiserName: sanitizeText(raw.advertiserName, fallback.advertiserName, 64),
    advertiserLogoUrl: sanitizeOptionalAssetUrl(raw.advertiserLogoUrl, fallback.advertiserLogoUrl),
    imageUrl: sanitizeOptionalAssetUrl(raw.imageUrl, fallback.imageUrl),
    placement: sanitizePlacement(raw.placement, fallback.placement),
    audience: sanitizeAudience(raw.audience, fallback.audience),
    targetStoreSlugs: sanitizeStringArray(raw.targetStoreSlugs),
    sponsoredLabel: sanitizeText(raw.sponsoredLabel, fallback.sponsoredLabel, 24),
    openInNewTab: typeof raw.openInNewTab === "boolean" ? raw.openInNewTab : fallback.openInNewTab,
    impressionCap: sanitizeNullableCount(raw.impressionCap, fallback.impressionCap),
    rotationSeconds: sanitizeRotationSeconds(raw.rotationSeconds, fallback.rotationSeconds),
    priority: sanitizePriority(raw.priority, fallback.priority),
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    startAt: sanitizeDateValue(raw.startAt),
    endAt: sanitizeDateValue(raw.endAt),
  };
}

export function resolveHomePromoEntries(rawEntries: unknown): HomePromoEntry[] {
  const input = Array.isArray(rawEntries) ? rawEntries : null;
  const source = input ?? defaultHomePromos;

  return source
    .filter((entry) => Boolean(entry))
    .slice(0, MAX_HOME_PROMOS)
    .map((entry, index) =>
      normalizePromo(
        entry,
        defaultHomePromos[index] ?? buildPromoFallback(index)
      )
    )
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
    .slice(0, MAX_HOME_PROMOS);
}

export async function getHomePromoEntries() {
  const latest = await prisma.activityLog.findFirst({
    where: { action: HOME_PROMO_ACTIVITY_ACTION, entityType: "HOME_PROMOS" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      metadata: true,
    },
  });

  const entries = resolveHomePromoEntries(
    latest?.metadata && typeof latest.metadata === "object"
      ? (latest.metadata as { promos?: unknown }).promos
      : null
  );

  return {
    entries,
    lastUpdatedAt: latest?.createdAt ?? null,
    lastUpdatedBy: latest?.user ?? null,
  };
}

export async function getHomePromoTrackingSummary(days = 30): Promise<HomePromoTrackingSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await prisma.activityLog.findMany({
    where: {
      action: HOME_PROMO_TRACK_ACTIVITY_ACTION,
      entityType: "HOME_PROMO",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_TRACK_LOGS,
    select: {
      entityId: true,
      createdAt: true,
      metadata: true,
    },
  });

  const summary: HomePromoTrackingSummary = {
    totals: { IMPRESSION: 0, CLICK: 0, DISMISS: 0 },
    anonymousTotals: { IMPRESSION: 0, CLICK: 0, DISMISS: 0 },
    ctr: 0,
    byPromoId: {},
  };

  for (const log of logs) {
    const promoId = log.entityId ?? "";
    if (!promoId) {
      continue;
    }

    const metadata =
      log.metadata && typeof log.metadata === "object"
        ? (log.metadata as Record<string, unknown>)
        : null;
    const eventType =
      typeof metadata?.eventType === "string" ? metadata.eventType.toUpperCase() : null;
    const placement =
      typeof metadata?.placement === "string" ? metadata.placement.toUpperCase() : null;
    const anonymous = metadata?.anonymous === true;

    if (eventType !== "IMPRESSION" && eventType !== "CLICK" && eventType !== "DISMISS") {
      continue;
    }

    const promoSummary =
      summary.byPromoId[promoId] ??
      (summary.byPromoId[promoId] = {
        impressions: 0,
        clicks: 0,
        dismisses: 0,
        anonymousImpressions: 0,
        anonymousClicks: 0,
        anonymousDismisses: 0,
        ctr: 0,
        placementBreakdown: {},
        lastEventAt: null,
      });

    summary.totals[eventType] += 1;
    if (anonymous) {
      summary.anonymousTotals[eventType] += 1;
    }

    if (eventType === "IMPRESSION") {
      promoSummary.impressions += 1;
      if (anonymous) promoSummary.anonymousImpressions += 1;
    } else if (eventType === "CLICK") {
      promoSummary.clicks += 1;
      if (anonymous) promoSummary.anonymousClicks += 1;
    } else {
      promoSummary.dismisses += 1;
      if (anonymous) promoSummary.anonymousDismisses += 1;
    }

    if (
      placement &&
      HOME_PROMO_PLACEMENTS.includes(placement as HomePromoPlacement)
    ) {
      promoSummary.placementBreakdown[placement as HomePromoPlacement] =
        (promoSummary.placementBreakdown[placement as HomePromoPlacement] ?? 0) + 1;
    }

    promoSummary.lastEventAt = promoSummary.lastEventAt
      ? new Date(log.createdAt) > new Date(promoSummary.lastEventAt)
        ? log.createdAt.toISOString()
        : promoSummary.lastEventAt
      : log.createdAt.toISOString();
  }

  summary.ctr =
    summary.totals.IMPRESSION > 0
      ? Math.round((summary.totals.CLICK / summary.totals.IMPRESSION) * 1000) / 10
      : 0;

  for (const promoId of Object.keys(summary.byPromoId)) {
    const promoSummary = summary.byPromoId[promoId];
    promoSummary.ctr =
      promoSummary.impressions > 0
        ? Math.round((promoSummary.clicks / promoSummary.impressions) * 1000) / 10
        : 0;
  }

  return summary;
}

export function getHomePromoAccentOptions() {
  return Array.from(accentOptions);
}

export function getHomePromoPlacementOptions() {
  return [...HOME_PROMO_PLACEMENTS];
}

export function getHomePromoAudienceOptions() {
  return [...HOME_PROMO_AUDIENCES];
}
