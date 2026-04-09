import { NotificationKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";
import {
  getHomePromoEntries,
  getHomePromoAccentOptions,
  persistHomePromoEntries,
  resolveHomePromoEntries,
} from "@/lib/homePromos";
import {
  HOME_PROMO_PLACEMENTS,
  type HomePromoEntry,
  type HomePromoPlacement,
} from "@/lib/homePromos.shared";
import {
  type AdRequestEntry,
  type AdRequestStatus,
} from "@/lib/adRequests.shared";

export const AD_REQUEST_ACTIVITY_ACTION = "AD_REQUEST_SUBMITTED";
export const AD_REQUEST_ENTITY_TYPE = "AD_REQUEST";
export const AD_REQUEST_ADMIN_ALERT_ACTION = "ADMIN_AD_REQUEST_SUBMITTED";

const PRESTA_STORE_SLUG = "jontaado-presta";
const STORE_SLUG_BY_VERTICAL: Record<string, string> = {
  PRESTA: "jontaado-presta",
  TIAK: "jontaado-tiak-tiak",
  GP: "jontaado-gp",
  CARS: "jontaado-cars",
  IMMO: "jontaado-immo",
  CARES: "jontaado-cares",
};
let cachedFallbackActorId: string | null | undefined;

type RawAdRequestInput = {
  companyName?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  websiteUrl?: unknown;
  campaignTitle?: unknown;
  campaignDescription?: unknown;
  ctaLabel?: unknown;
  desiredPlacement?: unknown;
  logoUrl?: unknown;
  imageUrl?: unknown;
  budget?: unknown;
  notes?: unknown;
  locale?: unknown;
  sourceVertical?: unknown;
};

function sanitizeText(value: unknown, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : "";
}

function sanitizeOptionalText(value: unknown, maxLength: number) {
  const normalized = sanitizeText(value, maxLength);
  return normalized || null;
}

function sanitizeEmail(value: unknown) {
  return sanitizeText(value, 120).toLowerCase();
}

function sanitizeWebsiteUrl(value: unknown) {
  const normalized = sanitizeText(value, 240);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(normalized)) {
    return `https://${normalized}`;
  }
  return "";
}

function sanitizeAssetUrl(value: unknown) {
  const normalized = sanitizeText(value, 240);
  if (!normalized) return null;
  if (normalized.startsWith("/") || /^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (/^[\w.-]+\.[a-z]{2,}.*$/i.test(normalized)) {
    return `https://${normalized}`;
  }
  return null;
}

function sanitizePlacement(value: unknown): HomePromoPlacement {
  return HOME_PROMO_PLACEMENTS.includes(value as HomePromoPlacement)
    ? (value as HomePromoPlacement)
    : "STORE_INLINE";
}

function buildRequestId() {
  return `adreq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getFallbackActorId(sessionUserId: string | null | undefined) {
  if (sessionUserId) {
    return sessionUserId;
  }

  if (cachedFallbackActorId !== undefined) {
    return cachedFallbackActorId;
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  cachedFallbackActorId = adminUser?.id ?? null;
  return cachedFallbackActorId;
}

function normalizeRequestPayload(input: RawAdRequestInput) {
  const desiredPlacement = sanitizePlacement(input.desiredPlacement);
  const sourceVertical = sanitizeText(input.sourceVertical, 32).toUpperCase() || "PRESTA";
  const targetStoreSlug = STORE_SLUG_BY_VERTICAL[sourceVertical] ?? PRESTA_STORE_SLUG;
  const locale = sanitizeText(input.locale, 12) || "fr";
  const isFr = locale.toLowerCase().startsWith("fr");

  return {
    companyName: sanitizeText(input.companyName, 80),
    contactName: sanitizeText(input.contactName, 80),
    email: sanitizeEmail(input.email),
    phone: sanitizeOptionalText(input.phone, 40),
    websiteUrl: sanitizeWebsiteUrl(input.websiteUrl),
    campaignTitle: sanitizeText(input.campaignTitle, 90),
    campaignDescription: sanitizeText(input.campaignDescription, 240),
    ctaLabel: sanitizeText(input.ctaLabel, 40) || (isFr ? "En savoir plus" : "Learn more"),
    desiredPlacement,
    targetStoreSlugs: desiredPlacement === "STORE_INLINE" ? [targetStoreSlug] : [],
    logoUrl: sanitizeAssetUrl(input.logoUrl),
    imageUrl: sanitizeAssetUrl(input.imageUrl),
    budget: sanitizeOptionalText(input.budget, 80),
    notes: sanitizeOptionalText(input.notes, 600),
    locale,
    sourceVertical,
  };
}

function assertValidRequest(payload: ReturnType<typeof normalizeRequestPayload>) {
  if (
    !payload.companyName ||
    !payload.contactName ||
    !payload.email ||
    !payload.websiteUrl ||
    !payload.campaignTitle ||
    !payload.campaignDescription
  ) {
    throw new Error("INVALID_AD_REQUEST");
  }
}

function toAdRequestEntry(log: {
  id: string;
  createdAt: Date;
  userId: string;
  metadata: unknown;
}) {
  const metadata =
    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
      ? (log.metadata as Record<string, unknown>)
      : {};

  const reviewedByRaw =
    metadata.reviewedBy && typeof metadata.reviewedBy === "object" && !Array.isArray(metadata.reviewedBy)
      ? (metadata.reviewedBy as Record<string, unknown>)
      : null;

  return {
    id: typeof metadata.requestId === "string" ? metadata.requestId : log.id,
    activityLogId: log.id,
    createdAt: log.createdAt.toISOString(),
    updatedAt:
      typeof metadata.updatedAt === "string" && metadata.updatedAt
        ? metadata.updatedAt
        : log.createdAt.toISOString(),
    status:
      metadata.status === "APPROVED" || metadata.status === "REJECTED" ? metadata.status : "PENDING",
    companyName: typeof metadata.companyName === "string" ? metadata.companyName : "",
    contactName: typeof metadata.contactName === "string" ? metadata.contactName : "",
    email: typeof metadata.email === "string" ? metadata.email : "",
    phone: typeof metadata.phone === "string" ? metadata.phone : null,
    websiteUrl: typeof metadata.websiteUrl === "string" ? metadata.websiteUrl : "",
    campaignTitle: typeof metadata.campaignTitle === "string" ? metadata.campaignTitle : "",
    campaignDescription:
      typeof metadata.campaignDescription === "string" ? metadata.campaignDescription : "",
    ctaLabel: typeof metadata.ctaLabel === "string" ? metadata.ctaLabel : "En savoir plus",
    desiredPlacement: sanitizePlacement(metadata.desiredPlacement),
    billingStatus:
      metadata.billingStatus === "PAYMENT_PENDING" ||
      metadata.billingStatus === "PAID" ||
      metadata.billingStatus === "READY"
        ? metadata.billingStatus
        : "QUOTE_PENDING",
    targetStoreSlugs: Array.isArray(metadata.targetStoreSlugs)
      ? metadata.targetStoreSlugs.filter((entry): entry is string => typeof entry === "string")
      : [],
    logoUrl: typeof metadata.logoUrl === "string" ? metadata.logoUrl : null,
    imageUrl: typeof metadata.imageUrl === "string" ? metadata.imageUrl : null,
    budget: typeof metadata.budget === "string" ? metadata.budget : null,
    notes: typeof metadata.notes === "string" ? metadata.notes : null,
    locale: typeof metadata.locale === "string" ? metadata.locale : "fr",
    sourceVertical: typeof metadata.sourceVertical === "string" ? metadata.sourceVertical : "PRESTA",
    submittedByUserId:
      typeof metadata.submittedByUserId === "string" ? metadata.submittedByUserId : null,
    anonymous: metadata.anonymous === true,
    adminNote: typeof metadata.adminNote === "string" ? metadata.adminNote : null,
    approvedCampaignId:
      typeof metadata.approvedCampaignId === "string" ? metadata.approvedCampaignId : null,
    reviewedAt: typeof metadata.reviewedAt === "string" ? metadata.reviewedAt : null,
    reviewedBy: reviewedByRaw
      ? {
          id: typeof reviewedByRaw.id === "string" ? reviewedByRaw.id : "",
          name: typeof reviewedByRaw.name === "string" ? reviewedByRaw.name : null,
          email: typeof reviewedByRaw.email === "string" ? reviewedByRaw.email : null,
        }
      : null,
  } satisfies AdRequestEntry;
}

function buildPromoFromRequest(request: AdRequestEntry): HomePromoEntry {
  const accents = getHomePromoAccentOptions();
  const defaultAccent =
    accents[0] ?? "from-emerald-400/22 via-emerald-500/8 to-zinc-950 border-emerald-300/20";
  const isFr = request.locale.toLowerCase().startsWith("fr");

  return {
    id: `request-${request.id}`.slice(0, 40),
    tag: isFr ? "Sponsorise" : "Sponsored",
    title: request.campaignTitle,
    description: request.campaignDescription,
    href: request.websiteUrl,
    cta: request.ctaLabel || (request.locale === "fr" ? "Voir le site" : "Visit site"),
    accentClassName: defaultAccent,
    advertiserName: request.companyName,
    advertiserLogoUrl: request.logoUrl,
    imageUrl: request.imageUrl,
    placement: request.desiredPlacement,
    audience: "ALL",
    targetStoreSlugs:
      request.desiredPlacement === "STORE_INLINE" && request.targetStoreSlugs.length === 0
        ? [STORE_SLUG_BY_VERTICAL[request.sourceVertical] ?? PRESTA_STORE_SLUG]
        : request.targetStoreSlugs,
    sponsoredLabel: isFr ? "Sponsorise" : "Sponsored",
    openInNewTab: true,
    impressionCap: null,
    rotationSeconds: 8,
    priority: 25,
    billingStatus: "PAYMENT_PENDING",
    enabled: false,
    startAt: null,
    endAt: null,
  };
}

function getPlacementLabelForEmail(locale: string, placement: HomePromoPlacement) {
  const isFr = locale === "fr";
  switch (placement) {
    case "HOME_POPUP":
      return isFr ? "Popup accueil" : "Homepage popup";
    case "HOME_INLINE":
      return isFr ? "Bandeau accueil" : "Homepage banner";
    case "HOME_PRODUCT_CARD":
      return isFr ? "Carte dans les produits" : "Product-feed card";
    case "STORE_INLINE":
      return isFr ? "Bandeau verticale" : "Vertical banner";
    default:
      return placement;
  }
}

function resolveAdminCampaignsLink(locale: string) {
  const base = process.env.PUBLIC_APP_ORIGIN || process.env.BASE_URL || process.env.NEXTAUTH_URL || "";
  const normalizedLocale = locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  const path = `/${normalizedLocale}/admin/campaigns`;
  if (!base) return path;
  return new URL(path, base).toString();
}

async function notifyAdminsAboutAdRequest(requestId: string, payload: ReturnType<typeof normalizeRequestPayload>) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
    take: 20,
  });

  if (admins.length === 0) return;

  const adminLink = resolveAdminCampaignsLink(payload.locale);
  const placementLabel = getPlacementLabelForEmail(payload.locale, payload.desiredPlacement);

  await Promise.allSettled(
    admins.map((admin) =>
      NotificationService.queueEmail({
        userId: admin.id,
        toEmail: admin.email ?? null,
        kind: NotificationKind.TRANSACTIONAL,
        templateKey: "ad_request_submitted",
        payload: {
          companyName: payload.companyName,
          campaignTitle: payload.campaignTitle,
          placementLabel,
          sourceVertical: payload.sourceVertical,
          link: adminLink,
        },
        dedupeKey: `ad_request_submitted:${requestId}:${admin.id}`,
      })
    )
  );
}

async function queueAdvertiserConfirmationEmail(
  requestId: string,
  payload: ReturnType<typeof normalizeRequestPayload>
) {
  if (!payload.email) return;

  const placementLabel = getPlacementLabelForEmail(payload.locale, payload.desiredPlacement);

  await NotificationService.queueEmail({
    toEmail: payload.email,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "ad_request_received",
    payload: {
      companyName: payload.companyName,
      campaignTitle: payload.campaignTitle,
      sourceVertical: payload.sourceVertical,
      placementLabel,
    },
    dedupeKey: `ad_request_received:${requestId}:${payload.email}`,
  });
}

async function createAdminActivityNotifications(
  requestId: string,
  payload: ReturnType<typeof normalizeRequestPayload>
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 20,
  });

  if (admins.length === 0) return;

  await prisma.activityLog.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      action: AD_REQUEST_ADMIN_ALERT_ACTION,
      entityType: AD_REQUEST_ENTITY_TYPE,
      entityId: requestId,
      metadata: {
        requestId,
        companyName: payload.companyName,
        campaignTitle: payload.campaignTitle,
        sourceVertical: payload.sourceVertical,
        desiredPlacement: payload.desiredPlacement,
        anonymous: true,
      } as Prisma.InputJsonValue,
    })),
  });
}

async function queueAdvertiserReviewEmail(request: AdRequestEntry) {
  if (!request.email) return;

  const isApproved = request.status === "APPROVED";
  const locale = request.locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  const placementLabel = getPlacementLabelForEmail(locale, request.desiredPlacement);
  const adminNote =
    request.adminNote?.trim() ||
    (locale === "fr"
      ? isApproved
        ? "Notre equipe te recontactera pour la suite de la mise en ligne et des conditions de diffusion."
        : "Tu peux reessayer avec un meilleur ciblage, un autre visuel ou plus de contexte."
      : isApproved
        ? "Our team will follow up with the next publication and placement steps."
        : "You can submit again with better targeting, a different visual, or more context.");

  await NotificationService.queueEmail({
    toEmail: request.email,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: isApproved ? "ad_request_approved" : "ad_request_rejected",
    payload: {
      companyName: request.companyName,
      campaignTitle: request.campaignTitle,
      sourceVertical: request.sourceVertical,
      placementLabel,
      adminNote,
    },
    dedupeKey: `ad_request_reviewed:${request.id}:${request.status}:${request.email}`,
  });
}

export async function submitAdRequest(input: RawAdRequestInput, sessionUserId?: string | null) {
  const normalized = normalizeRequestPayload(input);
  assertValidRequest(normalized);

  const actorId = await getFallbackActorId(sessionUserId);
  if (!actorId) {
    throw new Error("NO_AD_REQUEST_ACTOR");
  }

  const requestId = buildRequestId();
  const nowIso = new Date().toISOString();

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: AD_REQUEST_ACTIVITY_ACTION,
      entityType: AD_REQUEST_ENTITY_TYPE,
      entityId: requestId,
      metadata: {
        requestId,
        ...normalized,
        status: "PENDING",
        billingStatus: "QUOTE_PENDING",
        anonymous: !sessionUserId,
        submittedByUserId: sessionUserId ?? null,
        updatedAt: nowIso,
        reviewedAt: null,
        reviewedBy: null,
        adminNote: null,
        approvedCampaignId: null,
      },
    },
  });

  await Promise.allSettled([
    notifyAdminsAboutAdRequest(requestId, normalized),
    queueAdvertiserConfirmationEmail(requestId, normalized),
    createAdminActivityNotifications(requestId, normalized),
  ]);

  return requestId;
}

export async function getAdRequests() {
  const logs = await prisma.activityLog.findMany({
    where: {
      action: AD_REQUEST_ACTIVITY_ACTION,
      entityType: AD_REQUEST_ENTITY_TYPE,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      metadata: true,
    },
  });

  return logs.map(toAdRequestEntry);
}

export async function reviewAdRequest(options: {
  requestId: string;
  status: Exclude<AdRequestStatus, "PENDING">;
  adminNote?: string | null;
  reviewer: { id: string; name?: string | null; email?: string | null };
}) {
  const log = await prisma.activityLog.findFirst({
    where: {
      action: AD_REQUEST_ACTIVITY_ACTION,
      entityType: AD_REQUEST_ENTITY_TYPE,
      entityId: options.requestId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (!log) {
    throw new Error("AD_REQUEST_NOT_FOUND");
  }

  const current = toAdRequestEntry(log);
  let approvedCampaignId = current.approvedCampaignId;

  if (options.status === "APPROVED" && !approvedCampaignId) {
    const currentConfig = await getHomePromoEntries();
    const promoDraft = buildPromoFromRequest(current);
    const existing = currentConfig.entries.find((entry) => entry.id === promoDraft.id);
    const nextEntries = resolveHomePromoEntries(
      existing
        ? currentConfig.entries.map((entry) => (entry.id === promoDraft.id ? promoDraft : entry))
        : [promoDraft, ...currentConfig.entries]
    );
    await persistHomePromoEntries(nextEntries, options.reviewer.id);
    approvedCampaignId = promoDraft.id;
  }

  const metadata =
    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
      ? { ...(log.metadata as Record<string, unknown>) }
      : {};

  metadata.status = options.status;
  metadata.billingStatus =
    options.status === "APPROVED"
      ? metadata.billingStatus === "PAID" || metadata.billingStatus === "READY"
        ? metadata.billingStatus
        : "PAYMENT_PENDING"
      : metadata.billingStatus ?? "QUOTE_PENDING";
  metadata.adminNote = sanitizeOptionalText(options.adminNote, 600);
  metadata.reviewedAt = new Date().toISOString();
  metadata.updatedAt = metadata.reviewedAt;
  metadata.reviewedBy = {
    id: options.reviewer.id,
    name: options.reviewer.name ?? null,
    email: options.reviewer.email ?? null,
  };
  metadata.approvedCampaignId = approvedCampaignId ?? null;

  await prisma.activityLog.update({
    where: { id: log.id },
    data: { metadata: metadata as Prisma.InputJsonValue },
  });

  const refreshed = await prisma.activityLog.findUnique({
    where: { id: log.id },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (!refreshed) {
    throw new Error("AD_REQUEST_NOT_FOUND");
  }

  const reviewedEntry = toAdRequestEntry(refreshed);

  try {
    await queueAdvertiserReviewEmail(reviewedEntry);
  } catch {
    // Keep the review flow successful even if email queuing fails.
  }

  return reviewedEntry;
}
