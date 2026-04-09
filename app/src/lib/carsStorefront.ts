import { prisma } from "@/lib/prisma";
import { getUserRoles } from "@/lib/userRoles";

export type CarsStoreTab = "explore" | "dealers" | "my";

export type CarsStoreSearchParams = {
  tab?: string;
  country?: string;
  city?: string;
  make?: string;
  model?: string;
  yearMin?: string;
  yearMax?: string;
  mileageMax?: string;
  priceMin?: string;
  priceMax?: string;
  fuelType?: string;
  gearbox?: string;
  publisherType?: string;
  publisherSlug?: string;
  verifiedOnly?: string;
  sort?: string;
  dealerCountry?: string;
  dealerCity?: string;
  dealerVerified?: string;
  dealerTake?: string;
};

type ExplorerFuelType = "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG" | "OTHER";
type ExplorerGearbox = "MANUAL" | "AUTO" | "OTHER";

type CarsMyDealerSummary = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  city: string | null;
  country: string | null;
  logoUrl: string | null;
  role: "OWNER" | "AGENT";
  includedPublishedQuota: number;
  extraSlots: number;
  usedPublishedCount: number;
  boostCredits: number;
  featuredCredits: number;
};

type CarsMyRecentPurchase = {
  id: string;
  listingId: string | null;
  publisherId: string;
  kind: "FEATURED" | "BOOST" | "BOOST_PACK_10" | "FEATURED_PACK_4" | "EXTRA_SLOTS_10";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";
  createdAt: string;
};

type CarsMyListing = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  country: string;
  city: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: ExplorerFuelType;
  gearbox: ExplorerGearbox;
  imageUrls: string[];
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  isFeatured: boolean;
  featuredUntil: string | null;
  boostUntil: string | null;
  createdAt: string;
  updatedAt: string;
  publisherId: string | null;
  publisher: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    city: string | null;
    country: string | null;
    logoUrl: string | null;
  } | null;
};

export type CarsMyDashboardData = {
  canCreateDealerOnboarding: boolean;
  listings: CarsMyListing[];
  dealers: CarsMyDealerSummary[];
  recentPurchases: CarsMyRecentPurchase[];
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

export function normalizeCarsStoreTab(value: string | undefined): CarsStoreTab {
  if (value === "dealers" || value === "my") return value;
  return "explore";
}

function carsStorePath(locale: string, tab: CarsStoreTab, includeLocale: boolean) {
  const base = includeLocale ? `/${locale}/stores/jontaado-cars` : "/stores/jontaado-cars";
  if (tab === "dealers") return `${base}/dealers`;
  if (tab === "my") return `${base}/my`;
  return base;
}

export function buildCarsStoreHref(
  locale: string,
  options: {
    tab?: CarsStoreTab;
    params?: Partial<CarsStoreSearchParams>;
    includeLocale?: boolean;
  } = {}
) {
  const tab = options.tab ?? "explore";
  const params = options.params ?? {};
  const includeLocale = options.includeLocale ?? false;
  const search = new URLSearchParams();

  if (tab === "explore") {
    appendQueryParam(search, "country", params.country);
    appendQueryParam(search, "city", params.city);
    appendQueryParam(search, "make", params.make);
    appendQueryParam(search, "model", params.model);
    appendQueryParam(search, "yearMin", params.yearMin);
    appendQueryParam(search, "yearMax", params.yearMax);
    appendQueryParam(search, "mileageMax", params.mileageMax);
    appendQueryParam(search, "priceMin", params.priceMin);
    appendQueryParam(search, "priceMax", params.priceMax);
    appendQueryParam(search, "fuelType", params.fuelType);
    appendQueryParam(search, "gearbox", params.gearbox);
    appendQueryParam(search, "publisherType", params.publisherType);
    appendQueryParam(search, "publisherSlug", params.publisherSlug);
    appendQueryParam(search, "verifiedOnly", params.verifiedOnly);
    appendQueryParam(search, "sort", params.sort);
  }

  if (tab === "dealers") {
    appendQueryParam(search, "dealerCountry", params.dealerCountry);
    appendQueryParam(search, "dealerCity", params.dealerCity);
    appendQueryParam(search, "dealerVerified", params.dealerVerified);
    appendQueryParam(search, "dealerTake", params.dealerTake);
  }

  const query = search.toString();
  const basePath = carsStorePath(locale, tab, includeLocale);
  return `${basePath}${query ? `?${query}` : ""}`;
}

export function mapLegacyCarsSearchToStoreParams(searchParams: Partial<CarsStoreSearchParams>) {
  return {
    country: searchParams.country,
    city: searchParams.city,
    make: searchParams.make,
    model: searchParams.model,
    yearMin: searchParams.yearMin,
    yearMax: searchParams.yearMax,
    mileageMax: searchParams.mileageMax,
    priceMin: searchParams.priceMin,
    priceMax: searchParams.priceMax,
    fuelType: searchParams.fuelType,
    gearbox: searchParams.gearbox,
    publisherType: searchParams.publisherType,
    publisherSlug: searchParams.publisherSlug,
    verifiedOnly: searchParams.verifiedOnly,
    sort: searchParams.sort,
  } satisfies Partial<CarsStoreSearchParams>;
}

export function mapLegacyDealerSearchToStoreParams(searchParams: {
  country?: string;
  city?: string;
  verified?: string;
  take?: string;
}) {
  return {
    dealerCountry: searchParams.country,
    dealerCity: searchParams.city,
    dealerVerified: searchParams.verified,
    dealerTake: searchParams.take,
  } satisfies Partial<CarsStoreSearchParams>;
}

export async function getCarsExplorerData(filters: Partial<CarsStoreSearchParams>) {
  const where: Record<string, unknown> = { status: "PUBLISHED" };

  const country = filters.country?.trim().toUpperCase() || "";
  const city = filters.city?.trim() || "";
  const make = filters.make?.trim() || "";
  const model = filters.model?.trim() || "";
  const yearMin = parseIntQuery(filters.yearMin);
  const yearMax = parseIntQuery(filters.yearMax);
  const mileageMax = parseIntQuery(filters.mileageMax);
  const priceMin = parseIntQuery(filters.priceMin);
  const priceMax = parseIntQuery(filters.priceMax);
  const fuelType = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "LPG", "OTHER"].includes(
    filters.fuelType ?? ""
  )
    ? (filters.fuelType as ExplorerFuelType)
    : undefined;
  const gearbox = ["MANUAL", "AUTO", "OTHER"].includes(filters.gearbox ?? "")
    ? (filters.gearbox as ExplorerGearbox)
    : undefined;
  const publisherType =
    filters.publisherType === "DEALER" || filters.publisherType === "INDIVIDUAL"
      ? filters.publisherType
      : "";
  const publisherSlug = filters.publisherSlug?.trim() || "";
  const verifiedOnly = ["1", "true"].includes((filters.verifiedOnly ?? "").toLowerCase());

  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (make) where.make = { contains: make, mode: "insensitive" };
  if (model) where.model = { contains: model, mode: "insensitive" };
  if (fuelType) where.fuelType = fuelType;
  if (gearbox) where.gearbox = gearbox;

  if (yearMin !== null || yearMax !== null) {
    where.year = {
      ...(yearMin !== null ? { gte: yearMin } : {}),
      ...(yearMax !== null ? { lte: yearMax } : {}),
    };
  }
  if (mileageMax !== null) where.mileageKm = { lte: mileageMax };
  if (priceMin !== null || priceMax !== null) {
    where.priceCents = {
      ...(priceMin !== null ? { gte: priceMin } : {}),
      ...(priceMax !== null ? { lte: priceMax } : {}),
    };
  }

  if (publisherType === "DEALER") where.publisherId = { not: null };
  if (publisherType === "INDIVIDUAL") where.publisherId = null;

  if (publisherSlug) {
    where.publisher = { is: { slug: publisherSlug, type: "DEALER", status: "ACTIVE" } };
  }

  if (verifiedOnly && publisherType !== "INDIVIDUAL") {
    where.publisher = {
      is: {
        ...(publisherSlug ? { slug: publisherSlug } : {}),
        type: "DEALER",
        status: "ACTIVE",
        verified: true,
      },
    };
    where.publisherId = { not: null };
  }

  const sort = filters.sort === "price_asc" || filters.sort === "price_desc" ? filters.sort : "newest";
  const proRanking = sort === "newest";
  const now = new Date();
  const orderBy =
    sort === "price_asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price_desc"
        ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
        : [
            { isFeatured: "desc" as const },
            { featuredUntil: "desc" as const },
            { boostUntil: "desc" as const },
            { createdAt: "desc" as const },
          ];

  if (proRanking) {
    await prisma.carListing
      .updateMany({
        where: { status: "PUBLISHED", isFeatured: true, featuredUntil: { lt: now } },
        data: { isFeatured: false },
      })
      .catch(() => null);
  }

  const productWhere: Record<string, unknown> = {
    isActive: true,
    categories: {
      some: {
        category: {
          OR: [
            { slug: { contains: "vehicul", mode: "insensitive" } },
            { slug: { contains: "voitur", mode: "insensitive" } },
            { slug: { contains: "car", mode: "insensitive" } },
            { slug: { contains: "auto", mode: "insensitive" } },
            { name: { contains: "vehicul", mode: "insensitive" } },
            { name: { contains: "voitur", mode: "insensitive" } },
            { name: { contains: "car", mode: "insensitive" } },
            { name: { contains: "auto", mode: "insensitive" } },
          ],
        },
      },
    },
  };

  if (city) productWhere.pickupLocation = { contains: city, mode: "insensitive" };
  if (priceMin !== null || priceMax !== null) {
    productWhere.priceCents = {
      ...(priceMin !== null ? { gte: priceMin } : {}),
      ...(priceMax !== null ? { lte: priceMax } : {}),
    };
  }
  if (make || model) {
    const terms = [make, model].filter(Boolean);
    productWhere.AND = terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    }));
  }

  const [listings, dealers, shopVehicleProducts] = await Promise.all([
    prisma.carListing.findMany({
      where,
      orderBy,
      take: 60,
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        currency: true,
        country: true,
        city: true,
        make: true,
        model: true,
        year: true,
        mileageKm: true,
        fuelType: true,
        gearbox: true,
        imageUrls: true,
        isFeatured: true,
        featuredUntil: true,
        boostUntil: true,
        createdAt: true,
        publisherId: true,
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
    }),
    prisma.carPublisher.findMany({
      where: { type: "DEALER", status: "ACTIVE" },
      orderBy: [{ verified: "desc" }, { name: "asc" }],
      take: 100,
      select: { id: true, name: true, slug: true, verified: true },
    }),
    prisma.product.findMany({
      where: productWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 24,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        priceCents: true,
        currency: true,
        pickupLocation: true,
        createdAt: true,
        images: {
          orderBy: [{ position: "asc" }],
          take: 1,
          select: { url: true },
        },
      },
    }),
  ]);

  return {
    filters: {
      country: filters.country ?? "",
      city: filters.city ?? "",
      make: filters.make ?? "",
      model: filters.model ?? "",
      yearMin: filters.yearMin ?? "",
      yearMax: filters.yearMax ?? "",
      mileageMax: filters.mileageMax ?? "",
      priceMin: filters.priceMin ?? "",
      priceMax: filters.priceMax ?? "",
      fuelType: fuelType ?? "",
      gearbox: gearbox ?? "",
      publisherType,
      publisherSlug,
      verifiedOnly,
      sort,
    },
    listings,
    dealers,
    shopVehicleProducts,
    nowIso: now.toISOString(),
  };
}

export async function getCarsDealersData(filters: Partial<CarsStoreSearchParams>) {
  const country = filters.dealerCountry?.trim().toUpperCase() || "";
  const city = filters.dealerCity?.trim() || "";
  const verified = ["1", "true"].includes((filters.dealerVerified ?? "").toLowerCase());
  const takeRaw = Number(filters.dealerTake ?? "40");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 80) : 40;

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    type: "DEALER",
  };

  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (verified) where.verified = true;

  const dealers = await prisma.carPublisher.findMany({
    where,
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      country: true,
      city: true,
      logoUrl: true,
      _count: {
        select: {
          listings: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
  });

  return {
    filters: {
      dealerCountry: filters.dealerCountry ?? "",
      dealerCity: filters.dealerCity ?? "",
      dealerVerified: verified,
      dealerTake: String(take),
    },
    dealers,
  };
}

export async function getCarsMyDashboardData(userId: string | null | undefined) {
  if (!userId) return null;

  const [listings, dealerMemberships, roles] = await Promise.all([
    prisma.carListing.findMany({
      where: { ownerId: userId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        currency: true,
        country: true,
        city: true,
        make: true,
        model: true,
        year: true,
        mileageKm: true,
        fuelType: true,
        gearbox: true,
        imageUrls: true,
        status: true,
        isFeatured: true,
        featuredUntil: true,
        boostUntil: true,
        createdAt: true,
        updatedAt: true,
        publisherId: true,
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
    }),
    prisma.carPublisherMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        publisher: {
          status: "ACTIVE",
          type: "DEALER",
        },
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        role: true,
        publisher: {
          select: {
            id: true,
            name: true,
            slug: true,
            verified: true,
            city: true,
            country: true,
            logoUrl: true,
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
    }),
    getUserRoles(userId),
  ]);

  const dealerIds = dealerMemberships.map((item) => item.publisher.id);
  const listingIds = listings.map((item) => item.id);

  const [recentPurchases, publishedCounts] = await Promise.all([
    dealerIds.length || listingIds.length
      ? prisma.carMonetizationPurchase.findMany({
          where: {
            OR: [
              ...(dealerIds.length ? [{ publisherId: { in: dealerIds } }] : []),
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
      : Promise.resolve([]),
    dealerIds.length
      ? prisma.carListing.groupBy({
          by: ["publisherId"],
          where: {
            publisherId: { in: dealerIds },
            status: "PUBLISHED",
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const publishedCountByPublisher = new Map(
    publishedCounts.map((item) => [item.publisherId ?? "", item._count._all])
  );

  return {
    canCreateDealerOnboarding:
      (roles.includes("SELLER") || roles.includes("ADMIN")) && dealerMemberships.length === 0,
    listings: listings.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
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
    dealers: dealerMemberships.map((item) => ({
      id: item.publisher.id,
      name: item.publisher.name,
      slug: item.publisher.slug,
      verified: item.publisher.verified,
      city: item.publisher.city,
      country: item.publisher.country,
      logoUrl: item.publisher.logoUrl,
      role: item.role,
      includedPublishedQuota: item.publisher.includedPublishedQuota,
      extraSlots: item.publisher.extraSlots,
      usedPublishedCount: publishedCountByPublisher.get(item.publisher.id) ?? 0,
      boostCredits: item.publisher.monetizationBalance?.boostCredits ?? 0,
      featuredCredits: item.publisher.monetizationBalance?.featuredCredits ?? 0,
    })),
  } satisfies CarsMyDashboardData;
}
