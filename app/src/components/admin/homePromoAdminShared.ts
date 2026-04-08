import type { HomePromoEntry } from "@/lib/homePromos.shared";
import { isHomePromoScheduledLive } from "@/lib/homePromos.shared";

export const targetingOptions = [
  { value: "jontaado-cares", fr: "CARES", en: "CARES" },
  { value: "jontaado-presta", fr: "PRESTA", en: "PRESTA" },
  { value: "jontaado-cars", fr: "CARS", en: "CARS" },
  { value: "jontaado-gp", fr: "GP", en: "GP" },
  { value: "jontaado-immo", fr: "IMMO", en: "IMMO" },
  { value: "jontaado-tiak-tiak", fr: "TIAK", en: "TIAK" },
] as const;

export const homepageFormatPlacements = [
  "HOME_POPUP",
  "HOME_INLINE",
  "HOME_PRODUCT_CARD",
] as const;

export function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function getPlacementLabel(locale: string, placement: HomePromoEntry["placement"]) {
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

export function getAudienceLabel(locale: string, audience: HomePromoEntry["audience"]) {
  const isFr = locale === "fr";

  switch (audience) {
    case "ALL":
      return isFr ? "Tout le monde" : "Everyone";
    case "AUTH":
      return isFr ? "Connectes uniquement" : "Signed-in only";
    case "GUEST":
      return isFr ? "Invites uniquement" : "Guests only";
    default:
      return audience;
  }
}

export function getPreviewVariant(
  placement: HomePromoEntry["placement"]
): "popup" | "inline" | "product-card" {
  if (placement === "HOME_POPUP") return "popup";
  if (placement === "HOME_PRODUCT_CARD") return "product-card";
  return "inline";
}

export function buildGeneratedPromoId() {
  return `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getPromoLifecycleStatus(
  promo: HomePromoEntry,
  now: Date
): "all" | "live" | "scheduled" | "ended" | "draft" {
  if (!promo.enabled) {
    return "draft";
  }

  if (promo.startAt) {
    const startMs = new Date(promo.startAt).getTime();
    if (!Number.isNaN(startMs) && startMs > now.getTime()) {
      return "scheduled";
    }
  }

  if (promo.endAt) {
    const endMs = new Date(promo.endAt).getTime();
    if (!Number.isNaN(endMs) && endMs < now.getTime()) {
      return "ended";
    }
  }

  return isHomePromoScheduledLive(promo, now) ? "live" : "draft";
}

export function getPlacementContextDescription(locale: string, promo: HomePromoEntry) {
  const isFr = locale === "fr";
  const targetedLabels = targetingOptions
    .filter((option) => promo.targetStoreSlugs.includes(option.value))
    .map((option) => (isFr ? option.fr : option.en));

  switch (promo.placement) {
    case "HOME_POPUP":
      return isFr
        ? "Accueil > popup flottant en bas a droite"
        : "Homepage > floating popup bottom-right";
    case "HOME_INLINE":
      return isFr
        ? "Accueil > bandeau large apres deux lignes de produits"
        : "Homepage > wide banner after two product rows";
    case "HOME_PRODUCT_CARD":
      return isFr
        ? "Accueil > carte sponsorisee integree dans la grille produits"
        : "Homepage > sponsored card inside the product grid";
    case "STORE_INLINE":
      return targetedLabels.length > 0
        ? `${isFr ? "Verticales" : "Verticals"} > ${targetedLabels.join(", ")}`
        : isFr
          ? "Verticales > bandeau sous le hero"
          : "Verticals > banner below the hero";
    default:
      return promo.placement;
  }
}

export function getPromoStatusMeta(locale: string, promo: HomePromoEntry, now: Date) {
  const isFr = locale === "fr";
  const status = getPromoLifecycleStatus(promo, now);

  switch (status) {
    case "live":
      return {
        label: isFr ? "Active" : "Live",
        className: "border-emerald-300/30 bg-emerald-400/12 text-emerald-100",
      };
    case "scheduled":
      return {
        label: isFr ? "Programmee" : "Scheduled",
        className: "border-amber-300/25 bg-amber-400/10 text-amber-100",
      };
    case "ended":
      return {
        label: isFr ? "Terminee" : "Ended",
        className: "border-zinc-300/15 bg-zinc-400/10 text-zinc-300",
      };
    default:
      return {
        label: isFr ? "Brouillon" : "Draft",
        className: "border-sky-300/20 bg-sky-400/10 text-sky-100",
      };
  }
}

export function buildDemoPreviewPromos(
  locale: string,
  accentOptions: string[]
): Record<(typeof homepageFormatPlacements)[number], HomePromoEntry> {
  const isFr = locale === "fr";
  const popupAccent =
    accentOptions[0] ??
    "from-emerald-400/22 via-emerald-500/8 to-zinc-950 border-emerald-300/20";
  const inlineAccent =
    accentOptions[1] ??
    accentOptions[0] ??
    "from-amber-400/22 via-orange-500/8 to-zinc-950 border-amber-300/20";
  const productAccent =
    accentOptions[2] ??
    accentOptions[0] ??
    "from-cyan-400/22 via-sky-500/8 to-zinc-950 border-cyan-300/20";

  return {
    HOME_POPUP: {
      id: "demo-popup",
      tag: isFr ? "Popup premium" : "Premium popup",
      title: isFr ? "Campagne hero flottante" : "Floating hero campaign",
      description: isFr
        ? "Parfait pour une prise de parole forte, avec visuel, badge et CTA court."
        : "Ideal for a strong splash with visual, badge, and a short CTA.",
      href: "/stores/jontaado-cares",
      cta: isFr ? "Voir l'offre" : "See the offer",
      accentClassName: popupAccent,
      advertiserName: "JONTAADO ADS",
      advertiserLogoUrl: "/logo.png",
      imageUrl: "/stores/last_cares.png",
      placement: "HOME_POPUP",
      audience: "ALL",
      targetStoreSlugs: [],
      sponsoredLabel: isFr ? "Sponsorise" : "Sponsored",
      openInNewTab: false,
      impressionCap: null,
      rotationSeconds: 6,
      priority: 90,
      enabled: true,
      startAt: null,
      endAt: null,
    },
    HOME_INLINE: {
      id: "demo-inline",
      tag: isFr ? "Bandeau accueil" : "Homepage banner",
      title: isFr
        ? "Grand bandeau apres deux lignes de produits"
        : "Wide banner after two product rows",
      description: isFr
        ? "Le meilleur format pour raconter une offre, une promo ou un lancement de verticale."
        : "Best format to tell the story of an offer, promo, or vertical launch.",
      href: "/stores/jontaado-presta",
      cta: isFr ? "Decouvrir" : "Discover",
      accentClassName: inlineAccent,
      advertiserName: "JONTAADO ADS",
      advertiserLogoUrl: "/logo.png",
      imageUrl: "/stores/presta.png",
      placement: "HOME_INLINE",
      audience: "ALL",
      targetStoreSlugs: [],
      sponsoredLabel: isFr ? "Sponsorise" : "Sponsored",
      openInNewTab: false,
      impressionCap: null,
      rotationSeconds: 8,
      priority: 80,
      enabled: true,
      startAt: null,
      endAt: null,
    },
    HOME_PRODUCT_CARD: {
      id: "demo-card",
      tag: isFr ? "Carte native" : "Native card",
      title: isFr ? "Bloc sponsorise au format produit" : "Sponsored block in product format",
      description: isFr
        ? "Le plus discret pour se fondre dans le feed tout en gardant un CTA net."
        : "The most seamless way to blend into the feed with a clear CTA.",
      href: "/stores/jontaado-cars",
      cta: isFr ? "Reserver ce format" : "Book this format",
      accentClassName: productAccent,
      advertiserName: "JONTAADO ADS",
      advertiserLogoUrl: "/logo.png",
      imageUrl: "/stores/presta.png",
      placement: "HOME_PRODUCT_CARD",
      audience: "ALL",
      targetStoreSlugs: [],
      sponsoredLabel: isFr ? "Sponsorise" : "Sponsored",
      openInNewTab: false,
      impressionCap: null,
      rotationSeconds: 8,
      priority: 70,
      enabled: true,
      startAt: null,
      endAt: null,
    },
  };
}
