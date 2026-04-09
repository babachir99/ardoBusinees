import { prisma } from "@/lib/prisma";
import { getUserRoles } from "@/lib/userRoles";

export type ImmoStoreTab = "explore" | "agencies" | "my";

export type ImmoStoreSearchParams = {
  tab?: string;
  listingType?: string;
  propertyType?: string;
  minPrice?: string;
  maxPrice?: string;
  minSurface?: string;
  maxSurface?: string;
  city?: string;
  country?: string;
  publisherType?: string;
  verifiedOnly?: string;
  sort?: string;
  proRanking?: string;
  agencyCountry?: string;
  agencyCity?: string;
  agencyVerified?: string;
};

type ImmoListingType = "SALE" | "RENT";
type ImmoPropertyType = "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL" | "OTHER";

type ImmoAgencySummary = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  city: string | null;
  country: string | null;
  includedPublishedQuota: number;
  extraSlots: number;
  usedPublishedCount: number;
  boostCredits: number;
  featuredCredits: number;
};

type ImmoRecentPurchase = {
  id: string;
  listingId: string | null;
  publisherId: string;
  kind: "FEATURED" | "BOOST" | "BOOST_PACK_10" | "FEATURED_PACK_4" | "EXTRA_SLOTS_10";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";
  createdAt: string;
};

type ImmoMyListing = {
  id: string;
  title: string;
  description: string;
  listingType: ImmoListingType;
  propertyType: ImmoPropertyType;
  priceCents: number;
  currency: string;
  surfaceM2: number;
  rooms: number | null;
  city: string;
  country: string;
  imageUrls: string[];
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  isFeatured: boolean;
  featuredUntil: string | null;
  boostUntil: string | null;
  publisherId: string | null;
  publisher: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
  } | null;
  createdAt: string;
};

export type ImmoMyDashboardData = {
  canPublish: boolean;
  listings: ImmoMyListing[];
  recentPurchases: ImmoRecentPurchase[];
  agencies: ImmoAgencySummary[];
};

function appendQueryParam(search: URLSearchParams, key: string, value: string | undefined) {
  const normalized = value?.trim();
  if (normalized) {
    search.set(key, normalized);
  }
}

function parseIntQuery(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

export function normalizeImmoStoreTab(value: string | undefined): ImmoStoreTab {
  if (value === "agencies" || value === "my") return value;
  return "explore";
}

function immoStorePath(locale: string, tab: ImmoStoreTab, includeLocale: boolean) {
  const base = includeLocale ? `/${locale}/stores/jontaado-immo` : "/stores/jontaado-immo";
  if (tab === "agencies") return `${base}/agences`;
  if (tab === "my") return `${base}/my`;
  return base;
}

export function buildImmoStoreHref(
  locale: string,
  options: {
    tab?: ImmoStoreTab;
    params?: Partial<ImmoStoreSearchParams>;
    includeLocale?: boolean;
  } = {}
) {
  const tab = options.tab ?? "explore";
  const params = options.params ?? {};
  const includeLocale = options.includeLocale ?? false;
  const search = new URLSearchParams();

  if (tab === "explore") {
    appendQueryParam(search, "listingType", params.listingType);
    appendQueryParam(search, "propertyType", params.propertyType);
    appendQueryParam(search, "minPrice", params.minPrice);
    appendQueryParam(search, "maxPrice", params.maxPrice);
    appendQueryParam(search, "minSurface", params.minSurface);
    appendQueryParam(search, "maxSurface", params.maxSurface);
    appendQueryParam(search, "city", params.city);
    appendQueryParam(search, "country", params.country);
    appendQueryParam(search, "publisherType", params.publisherType);
    appendQueryParam(search, "verifiedOnly", params.verifiedOnly);
    appendQueryParam(search, "sort", params.sort);
    appendQueryParam(search, "proRanking", params.proRanking);
  }

  if (tab === "agencies") {
    appendQueryParam(search, "agencyCountry", params.agencyCountry);
    appendQueryParam(search, "agencyCity", params.agencyCity);
    appendQueryParam(search, "agencyVerified", params.agencyVerified);
  }

  const query = search.toString();
  const basePath = immoStorePath(locale, tab, includeLocale);
  return `${basePath}${query ? `?${query}` : ""}`;
}

export function mapLegacyImmoSearchToStoreParams(searchParams: Partial<ImmoStoreSearchParams>) {
  return {
    listingType: searchParams.listingType,
    propertyType: searchParams.propertyType,
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
    minSurface: searchParams.minSurface,
    maxSurface: searchParams.maxSurface,
    city: searchParams.city,
    country: searchParams.country,
    publisherType: searchParams.publisherType,
    verifiedOnly: searchParams.verifiedOnly,
    sort: searchParams.sort,
    proRanking: searchParams.proRanking,
  } satisfies Partial<ImmoStoreSearchParams>;
}

export function mapLegacyAgencySearchToStoreParams(searchParams: {
  country?: string;
  city?: string;
  verified?: string;
}) {
  return {
    agencyCountry: searchParams.country,
    agencyCity: searchParams.city,
    agencyVerified: searchParams.verified,
  } satisfies Partial<ImmoStoreSearchParams>;
}

export async function getImmoExplorerData(filters: Partial<ImmoStoreSearchParams>) {
  const listingType =
    filters.listingType === "SALE" || filters.listingType === "RENT"
      ? filters.listingType
      : undefined;
  const propertyType = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"].includes(
    filters.propertyType ?? ""
  )
    ? (filters.propertyType as ImmoPropertyType)
    : undefined;

  const where: Record<string, unknown> = { status: "PUBLISHED" };
  const now = new Date();
  const minPrice = parseIntQuery(filters.minPrice);
  const maxPrice = parseIntQuery(filters.maxPrice);
  const minSurface = parseIntQuery(filters.minSurface);
  const maxSurface = parseIntQuery(filters.maxSurface);

  if (listingType) where.listingType = listingType;
  if (propertyType) where.propertyType = propertyType;
  if (filters.city?.trim()) {
    where.city = { contains: filters.city.trim(), mode: "insensitive" };
  }
  if (filters.country?.trim()) {
    where.country = filters.country.trim().toUpperCase();
  }
  if (minPrice !== null || maxPrice !== null) {
    where.priceCents = {
      ...(minPrice !== null ? { gte: minPrice } : {}),
      ...(maxPrice !== null ? { lte: maxPrice } : {}),
    };
  }
  if (minSurface !== null || maxSurface !== null) {
    where.surfaceM2 = {
      ...(minSurface !== null ? { gte: minSurface } : {}),
      ...(maxSurface !== null ? { lte: maxSurface } : {}),
    };
  }

  const publisherType =
    filters.publisherType === "AGENCY" || filters.publisherType === "INDIVIDUAL"
      ? filters.publisherType
      : "";
  const verifiedOnly = ["1", "true"].includes((filters.verifiedOnly ?? "").toLowerCase());

  if (publisherType === "AGENCY") {
    where.publisherId = { not: null };
  } else if (publisherType === "INDIVIDUAL") {
    where.publisherId = null;
  }

  if (verifiedOnly) {
    if (publisherType === "AGENCY") {
      where.publisher = {
        is: {
          type: "AGENCY",
          status: "ACTIVE",
          verified: true,
        },
      };
    } else if (publisherType !== "INDIVIDUAL") {
      where.OR = [
        { publisherId: null },
        {
          publisher: {
            is: {
              type: "AGENCY",
              status: "ACTIVE",
              verified: true,
            },
          },
        },
      ];
    }
  }

  const sort =
    filters.sort === "price_asc" || filters.sort === "price_desc" ? filters.sort : "newest";
  const proRanking = ["0", "false"].includes((filters.proRanking ?? "").toLowerCase())
    ? false
    : true;
  const orderBy =
    sort === "price_asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price_desc"
        ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
        : proRanking
          ? [
              { isFeatured: "desc" as const },
              { featuredUntil: "desc" as const },
              { boostUntil: "desc" as const },
              { createdAt: "desc" as const },
            ]
          : [{ createdAt: "desc" as const }];

  if (proRanking) {
    await prisma.immoListing
      .updateMany({
        where: {
          status: "PUBLISHED",
          isFeatured: true,
          featuredUntil: { lt: now },
        },
        data: { isFeatured: false },
      })
      .catch(() => null);
  }

  const listings = await prisma.immoListing.findMany({
    where,
    orderBy,
    take: 60,
    select: {
      id: true,
      title: true,
      description: true,
      listingType: true,
      propertyType: true,
      priceCents: true,
      currency: true,
      surfaceM2: true,
      rooms: true,
      city: true,
      country: true,
      imageUrls: true,
      isFeatured: true,
      featuredUntil: true,
      boostUntil: true,
      createdAt: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
          logoUrl: true,
        },
      },
    },
  });

  return {
    nowIso: now.toISOString(),
    filters: {
      listingType: listingType ?? "",
      propertyType: propertyType ?? "",
      minPrice: filters.minPrice?.trim() ?? "",
      maxPrice: filters.maxPrice?.trim() ?? "",
      minSurface: filters.minSurface?.trim() ?? "",
      maxSurface: filters.maxSurface?.trim() ?? "",
      city: filters.city?.trim() ?? "",
      country: filters.country?.trim().toUpperCase() ?? "",
      publisherType,
      verifiedOnly,
      sort,
      proRanking,
    },
    listings,
  };
}

export async function getImmoAgenciesData(filters: Partial<ImmoStoreSearchParams>) {
  const country = (filters.agencyCountry ?? "").trim().toUpperCase();
  const city = (filters.agencyCity ?? "").trim();
  const verifiedOnly = ["1", "true"].includes((filters.agencyVerified ?? "").trim().toLowerCase());

  const agencies = await prisma.immoPublisher.findMany({
    where: {
      type: "AGENCY",
      status: "ACTIVE",
      ...(country ? { country } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
      ...(verifiedOnly ? { verified: true } : {}),
    },
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      country: true,
      city: true,
      logoUrl: true,
      createdAt: true,
    },
  });

  return {
    filters: {
      agencyCountry: country,
      agencyCity: city,
      agencyVerified: verifiedOnly,
    },
    agencies,
  };
}

export async function getImmoMyDashboardData(userId: string): Promise<ImmoMyDashboardData> {
  const listings = await prisma.immoListing.findMany({
    where: { ownerId: userId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      listingType: true,
      propertyType: true,
      priceCents: true,
      currency: true,
      surfaceM2: true,
      rooms: true,
      city: true,
      country: true,
      imageUrls: true,
      status: true,
      isFeatured: true,
      featuredUntil: true,
      boostUntil: true,
      publisherId: true,
      createdAt: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
        },
      },
    },
  });

  const agencies = await prisma.immoPublisherMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
      publisher: {
        status: "ACTIVE",
        type: "AGENCY",
      },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
          includedPublishedQuota: true,
          extraSlots: true,
          monetizationBalance: {
            select: {
              boostCredits: true,
              featuredCredits: true,
            },
          },
        },
      },
    },
  });

  const agencyIds = agencies.map((item) => item.publisher.id);
  const listingIds = listings.map((item) => item.id);
  const recentPurchases =
    agencyIds.length || listingIds.length
      ? await prisma.immoMonetizationPurchase.findMany({
          where: {
            OR: [
              ...(agencyIds.length ? [{ publisherId: { in: agencyIds } }] : []),
              ...(listingIds.length ? [{ listingId: { in: listingIds } }] : []),
            ],
          },
          orderBy: [{ createdAt: "desc" }],
          take: 120,
          select: {
            id: true,
            listingId: true,
            publisherId: true,
            kind: true,
            status: true,
            createdAt: true,
          },
        })
      : [];

  const publishedCounts = agencyIds.length
    ? await prisma.immoListing.groupBy({
        by: ["publisherId"],
        where: {
          publisherId: { in: agencyIds },
          status: "PUBLISHED",
        },
        _count: {
          _all: true,
        },
      })
    : [];

  const publishedCountByPublisher = new Map(
    publishedCounts.map((item) => [item.publisherId ?? "", item._count._all])
  );
  const roles = await getUserRoles(userId);
  const canPublish = roles.some(
    (role) => role === "SELLER" || role === "IMMO_AGENT" || role === "ADMIN"
  );

  return {
    canPublish,
    listings: listings.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      featuredUntil: item.featuredUntil?.toISOString() ?? null,
      boostUntil: item.boostUntil?.toISOString() ?? null,
    })),
    recentPurchases: recentPurchases.map((item) => ({
      id: item.id,
      listingId: item.listingId,
      publisherId: item.publisherId,
      kind: item.kind,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    agencies: agencies.map((item) => ({
      id: item.publisher.id,
      name: item.publisher.name,
      slug: item.publisher.slug,
      verified: item.publisher.verified,
      city: item.publisher.city,
      country: item.publisher.country,
      includedPublishedQuota: item.publisher.includedPublishedQuota,
      extraSlots: item.publisher.extraSlots,
      usedPublishedCount: publishedCountByPublisher.get(item.publisher.id) ?? 0,
      boostCredits: item.publisher.monetizationBalance?.boostCredits ?? 0,
      featuredCredits: item.publisher.monetizationBalance?.featuredCredits ?? 0,
    })),
  };
}
