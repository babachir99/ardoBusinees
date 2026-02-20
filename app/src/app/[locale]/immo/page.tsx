import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type SearchParams = {
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
};

function parseIntQuery(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function listingTypeLabel(locale: string, listingType: "SALE" | "RENT") {
  if (locale === "fr") {
    return listingType === "SALE" ? "Vente" : "Location";
  }
  return listingType === "SALE" ? "Sale" : "Rent";
}

function propertyTypeLabel(
  locale: string,
  propertyType: "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL" | "OTHER"
) {
  if (locale === "fr") {
    if (propertyType === "APARTMENT") return "Appartement";
    if (propertyType === "HOUSE") return "Maison";
    if (propertyType === "LAND") return "Terrain";
    if (propertyType === "COMMERCIAL") return "Commercial";
    return "Autre";
  }

  if (propertyType === "APARTMENT") return "Apartment";
  if (propertyType === "HOUSE") return "House";
  if (propertyType === "LAND") return "Land";
  if (propertyType === "COMMERCIAL") return "Commercial";
  return "Other";
}

export default async function ImmoListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);

  const listingType = filters.listingType === "SALE" || filters.listingType === "RENT" ? filters.listingType : undefined;
  const propertyType = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"].includes(
    filters.propertyType ?? ""
  )
    ? (filters.propertyType as "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL" | "OTHER")
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

  const publisherType = filters.publisherType === "AGENCY" || filters.publisherType === "INDIVIDUAL" ? filters.publisherType : "";
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

  const sort = filters.sort === "price_asc" || filters.sort === "price_desc" ? filters.sort : "newest";
  const proRanking = ["0", "false"].includes((filters.proRanking ?? "").toLowerCase()) ? false : true;
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
    await prisma.immoListing.updateMany({
      where: {
        status: "PUBLISHED",
        isFeatured: true,
        featuredUntil: { lt: now },
      },
      data: { isFeatured: false },
    }).catch(() => null);
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

  const t = {
    title: locale === "fr" ? "JONTAADO IMMO" : "JONTAADO IMMO",
    subtitle:
      locale === "fr"
        ? "Annonces verifiees, filtres clairs, contact interne securise."
        : "Verified listings, clear filters and secure internal contact.",
    filters: locale === "fr" ? "Filtres" : "Filters",
    stores: locale === "fr" ? "Boutiques" : "Stores",
    typeLabel: locale === "fr" ? "Type" : "Type",
    propertyLabel: locale === "fr" ? "Bien" : "Property",
    cityLabel: locale === "fr" ? "Ville" : "City",
    countryLabel: locale === "fr" ? "Pays" : "Country",
    minPriceLabel: locale === "fr" ? "Prix min" : "Min price",
    maxPriceLabel: locale === "fr" ? "Prix max" : "Max price",
    minSurfaceLabel: locale === "fr" ? "Surface min (m2)" : "Min surface (m2)",
    maxSurfaceLabel: locale === "fr" ? "Surface max (m2)" : "Max surface (m2)",
    apply: locale === "fr" ? "Appliquer" : "Apply",
    listingTypeSale: locale === "fr" ? "Vente" : "Sale",
    listingTypeRent: locale === "fr" ? "Location" : "Rent",
    propertyApartment: locale === "fr" ? "Appartement" : "Apartment",
    propertyHouse: locale === "fr" ? "Maison" : "House",
    propertyLand: locale === "fr" ? "Terrain" : "Land",
    propertyCommercial: locale === "fr" ? "Commercial" : "Commercial",
    propertyOther: locale === "fr" ? "Autre" : "Other",
    publisherFilter: locale === "fr" ? "Particuliers / Agences" : "Individuals / Agencies",
    verifiedAgencies: locale === "fr" ? "Agences verifiees" : "Verified agencies",
    individuals: locale === "fr" ? "Particuliers" : "Individuals",
    agencies: locale === "fr" ? "Agences" : "Agencies",
    mine: locale === "fr" ? "Mes annonces" : "My listings",
    login: locale === "fr" ? "Se connecter" : "Sign in",
    details: locale === "fr" ? "Voir" : "View",
    featured: locale === "fr" ? "Mis en avant" : "Featured",
    boost: locale === "fr" ? "Booste" : "Boost",
    rooms: locale === "fr" ? "pieces" : "rooms",
    empty:
      locale === "fr"
        ? "Aucune annonce publiee pour ces filtres."
        : "No published listings for these filters.",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-300/15 via-zinc-900 to-zinc-900 p-8">
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t.subtitle}</p>
          <div className="mt-4 flex gap-3 text-xs">
            <Link href="/stores/jontaado-immo" className="rounded-full border border-white/20 px-3 py-1">
              {t.stores}
            </Link>
            <Link href="/immo/agences" className="rounded-full border border-white/20 px-3 py-1">
              {t.agencies}
            </Link>
            {session?.user?.id ? (
              <Link href="/immo/my" className="rounded-full border border-emerald-300/40 px-3 py-1 text-emerald-200">
                {t.mine}
              </Link>
            ) : (
              <Link href="/login?callbackUrl=/immo/my" className="rounded-full border border-white/20 px-3 py-1">
                {t.login}
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.filters}</p>
          <form className="mt-3 grid gap-2 md:grid-cols-4">
            <select name="listingType" defaultValue={listingType ?? ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.typeLabel}</option>
              <option value="SALE">{t.listingTypeSale}</option>
              <option value="RENT">{t.listingTypeRent}</option>
            </select>
            <select name="propertyType" defaultValue={propertyType ?? ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.propertyLabel}</option>
              <option value="APARTMENT">{t.propertyApartment}</option>
              <option value="HOUSE">{t.propertyHouse}</option>
              <option value="LAND">{t.propertyLand}</option>
              <option value="COMMERCIAL">{t.propertyCommercial}</option>
              <option value="OTHER">{t.propertyOther}</option>
            </select>
            <input name="city" defaultValue={filters.city ?? ""} placeholder={t.cityLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="country" defaultValue={filters.country ?? ""} placeholder={t.countryLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="minPrice" defaultValue={filters.minPrice ?? ""} placeholder={t.minPriceLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="maxPrice" defaultValue={filters.maxPrice ?? ""} placeholder={t.maxPriceLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="minSurface" defaultValue={filters.minSurface ?? ""} placeholder={t.minSurfaceLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <select name="publisherType" defaultValue={publisherType} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.publisherFilter}</option>
              <option value="INDIVIDUAL">{t.individuals}</option>
              <option value="AGENCY">{t.agencies}</option>
            </select>
            <select name="verifiedOnly" defaultValue={verifiedOnly ? "true" : ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.verifiedAgencies}</option>
              <option value="true">{t.verifiedAgencies}</option>
            </select>
            <div className="flex gap-2">
              <input name="maxSurface" defaultValue={filters.maxSurface ?? ""} placeholder={t.maxSurfaceLabel} className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
              <button className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950">{t.apply}</button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
              {t.empty}
            </div>
          ) : (
            listings.map((listing) => (
              <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-zinc-400">{listingTypeLabel(locale, listing.listingType)} - {propertyTypeLabel(locale, listing.propertyType)}</p>
                  {listing.featuredUntil && new Date(listing.featuredUntil) > now ? (
                    <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      {t.featured}
                    </span>
                  ) : null}
                  {listing.boostUntil && new Date(listing.boostUntil) > now ? (
                    <span className="rounded-full border border-sky-300/40 bg-sky-300/15 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                      {t.boost}
                    </span>
                  ) : null}
                </div>
                {listing.imageUrls[0] ? (
                  <img
                    src={listing.imageUrls[0]}
                    alt={listing.title}
                    className="h-40 w-full rounded-xl border border-white/10 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 w-full rounded-xl border border-dashed border-white/15 bg-zinc-950/40" />
                )}
                <h2 className="mt-2 text-lg font-semibold text-white">{listing.title}</h2>
                <p className="mt-2 text-sm text-zinc-300 line-clamp-3">{listing.description}</p>
                <p className="mt-3 text-sm text-emerald-200">{formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.surfaceM2} m2 - {listing.rooms ?? "-"} {t.rooms}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.city}, {listing.country}</p>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">{listing.publisher?.name ?? "JONTAADO"}</p>
                  <Link href={`/immo/${listing.id}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                    {t.details}
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
