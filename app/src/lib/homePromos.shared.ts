export const HOME_PROMO_PLACEMENTS = [
  "HOME_POPUP",
  "HOME_INLINE",
  "HOME_PRODUCT_CARD",
  "STORE_INLINE",
] as const;
export const HOME_PROMO_AUDIENCES = ["ALL", "AUTH", "GUEST"] as const;

export type HomePromoPlacement = (typeof HOME_PROMO_PLACEMENTS)[number];
export type HomePromoAudience = (typeof HOME_PROMO_AUDIENCES)[number];

export type HomePromoEntry = {
  id: string;
  tag: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  accentClassName: string;
  advertiserName: string;
  advertiserLogoUrl: string | null;
  imageUrl: string | null;
  placement: HomePromoPlacement;
  audience: HomePromoAudience;
  targetStoreSlugs: string[];
  sponsoredLabel: string;
  openInNewTab: boolean;
  impressionCap: number | null;
  rotationSeconds: number | null;
  priority: number;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
};

export function isHomePromoScheduledLive(
  entry: Pick<HomePromoEntry, "enabled" | "startAt" | "endAt">,
  now = new Date()
) {
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

type FilterHomePromosOptions = {
  placement?: HomePromoPlacement;
  isLoggedIn?: boolean;
  storeSlug?: string | null;
  now?: Date;
};

export function filterHomePromosForPlacement(
  entries: HomePromoEntry[],
  options: FilterHomePromosOptions = {}
) {
  const { placement, isLoggedIn, storeSlug, now = new Date() } = options;

  return entries.filter((entry) => {
    if (!isHomePromoScheduledLive(entry, now)) {
      return false;
    }

    if (placement && entry.placement !== placement) {
      return false;
    }

    if (entry.audience === "AUTH" && !isLoggedIn) {
      return false;
    }

    if (entry.audience === "GUEST" && isLoggedIn) {
      return false;
    }

    if (storeSlug && entry.targetStoreSlugs.length > 0 && !entry.targetStoreSlugs.includes(storeSlug)) {
      return false;
    }

    return true;
  });
}
