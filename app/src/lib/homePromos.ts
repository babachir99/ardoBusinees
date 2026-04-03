import { prisma } from "@/lib/prisma";

export const HOME_PROMO_ACTIVITY_ACTION = "ADMIN_HOME_PROMOS_UPDATED";
const MAX_HOME_PROMOS = 4;

export type HomePromoEntry = {
  id: string;
  tag: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  accentClassName: string;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
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
    enabled: true,
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
  if (!normalized.startsWith("/")) {
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
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    startAt: sanitizeDateValue(raw.startAt),
    endAt: sanitizeDateValue(raw.endAt),
  };
}

export function resolveHomePromoEntries(rawEntries: unknown): HomePromoEntry[] {
  const input = Array.isArray(rawEntries) ? rawEntries : [];
  const merged = defaultHomePromos.map((fallback, index) =>
    normalizePromo(input[index], fallback)
  );

  return merged.slice(0, MAX_HOME_PROMOS);
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

export function getHomePromoAccentOptions() {
  return Array.from(accentOptions);
}

export function isHomePromoScheduledLive(entry: Pick<HomePromoEntry, "enabled" | "startAt" | "endAt">, now = new Date()) {
  if (!entry.enabled) {
    return false;
  }

  const nowMs = now.getTime();

  if (entry.startAt) {
    const startMs = new Date(entry.startAt).getTime();
    if (!Number.isNaN(startMs) && startMs > nowMs) {
      return false;
    }
  }

  if (entry.endAt) {
    const endMs = new Date(entry.endAt).getTime();
    if (!Number.isNaN(endMs) && endMs < nowMs) {
      return false;
    }
  }

  return true;
}
