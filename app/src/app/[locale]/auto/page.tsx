import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type SearchParams = {
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
};

function parseIntQuery(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

export default async function AutoListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);

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
  const fuelType = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"].includes(filters.fuelType ?? "")
    ? (filters.fuelType as "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC" | "OTHER")
    : undefined;
  const gearbox = ["MANUAL", "AUTO", "OTHER"].includes(filters.gearbox ?? "")
    ? (filters.gearbox as "MANUAL" | "AUTO" | "OTHER")
    : undefined;
  const publisherType = filters.publisherType === "DEALER" || filters.publisherType === "INDIVIDUAL" ? filters.publisherType : "";
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

  if (mileageMax !== null) {
    where.mileageKm = { lte: mileageMax };
  }

  if (priceMin !== null || priceMax !== null) {
    where.priceCents = {
      ...(priceMin !== null ? { gte: priceMin } : {}),
      ...(priceMax !== null ? { lte: priceMax } : {}),
    };
  }

  if (publisherType === "DEALER") {
    where.publisherId = { not: null };
  } else if (publisherType === "INDIVIDUAL") {
    where.publisherId = null;
  }

  if (publisherSlug) {
    where.publisher = {
      is: {
        slug: publisherSlug,
        type: "DEALER",
        status: "ACTIVE",
      },
    };
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
  const orderBy =
    sort === "price_asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price_desc"
      ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const listings = await prisma.autoListing.findMany({
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
  });

  const dealers = await prisma.autoPublisher.findMany({
    where: { type: "DEALER", status: "ACTIVE" },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
    },
  });

  const t = {
    title: locale === "fr" ? "JONTAADO AUTO" : "JONTAADO AUTO",
    subtitle:
      locale === "fr"
        ? "Annonces auto publiques avec filtres clairs et vitrines concessionnaires."
        : "Public auto listings with clear filters and dealer storefronts.",
    filters: locale === "fr" ? "Filtres" : "Filters",
    country: locale === "fr" ? "Pays" : "Country",
    city: locale === "fr" ? "Ville" : "City",
    make: locale === "fr" ? "Marque" : "Make",
    model: locale === "fr" ? "Modele" : "Model",
    yearMin: locale === "fr" ? "Annee min" : "Min year",
    yearMax: locale === "fr" ? "Annee max" : "Max year",
    mileageMax: locale === "fr" ? "Km max" : "Max km",
    priceMin: locale === "fr" ? "Prix min" : "Min price",
    priceMax: locale === "fr" ? "Prix max" : "Max price",
    fuelType: locale === "fr" ? "Carburant" : "Fuel",
    gearbox: locale === "fr" ? "Boite" : "Gearbox",
    dealerType: locale === "fr" ? "Particuliers / Concessionnaires" : "Individuals / Dealers",
    dealerSlug: locale === "fr" ? "Concessionnaire" : "Dealer",
    verifiedOnly: locale === "fr" ? "Concessionnaires verifies" : "Verified dealers",
    sort: locale === "fr" ? "Tri" : "Sort",
    newest: locale === "fr" ? "Plus recentes" : "Newest",
    priceAsc: locale === "fr" ? "Prix croissant" : "Price asc",
    priceDesc: locale === "fr" ? "Prix decroissant" : "Price desc",
    apply: locale === "fr" ? "Appliquer" : "Apply",
    myListings: locale === "fr" ? "Mes annonces" : "My listings",
    login: locale === "fr" ? "Se connecter" : "Sign in",
    immo: locale === "fr" ? "IMMO" : "IMMO",
    dealers: locale === "fr" ? "Concessionnaires" : "Dealers",
    details: locale === "fr" ? "Voir" : "View",
    km: locale === "fr" ? "km" : "km",
    individual: locale === "fr" ? "Particulier" : "Individual",
    dealerBadge: locale === "fr" ? "Concessionnaire" : "Dealer",
    individualBadge: locale === "fr" ? "Particulier" : "Individual",
    verified: locale === "fr" ? "Verifie" : "Verified",
    empty:
      locale === "fr"
        ? "Aucune annonce auto publiee pour ces filtres."
        : "No published auto listing for these filters.",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-8">
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t.subtitle}</p>
          <div className="mt-4 flex gap-3 text-xs">
            <Link href="/immo" className="rounded-full border border-white/20 px-3 py-1">
              {t.immo}
            </Link>
            <Link href="/auto/dealers" className="rounded-full border border-cyan-300/40 px-3 py-1 text-cyan-200">
              {t.dealers}
            </Link>
            {session?.user?.id ? (
              <Link href="/auto/my" className="rounded-full border border-cyan-300/40 px-3 py-1 text-cyan-200">
                {t.myListings}
              </Link>
            ) : (
              <Link href="/login?callbackUrl=/auto/my" className="rounded-full border border-white/20 px-3 py-1">
                {t.login}
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.filters}</p>
          <form className="mt-3 grid gap-2 md:grid-cols-4">
            <input name="country" defaultValue={filters.country ?? ""} placeholder={t.country} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="city" defaultValue={filters.city ?? ""} placeholder={t.city} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="make" defaultValue={filters.make ?? ""} placeholder={t.make} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="model" defaultValue={filters.model ?? ""} placeholder={t.model} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="yearMin" defaultValue={filters.yearMin ?? ""} placeholder={t.yearMin} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="yearMax" defaultValue={filters.yearMax ?? ""} placeholder={t.yearMax} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="mileageMax" defaultValue={filters.mileageMax ?? ""} placeholder={t.mileageMax} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <select name="fuelType" defaultValue={fuelType ?? ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.fuelType}</option>
              <option value="GASOLINE">Gasoline</option>
              <option value="DIESEL">Diesel</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ELECTRIC">Electric</option>
              <option value="OTHER">Other</option>
            </select>
            <select name="gearbox" defaultValue={gearbox ?? ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.gearbox}</option>
              <option value="MANUAL">Manual</option>
              <option value="AUTO">Auto</option>
              <option value="OTHER">Other</option>
            </select>
            <select name="publisherType" defaultValue={publisherType} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.dealerType}</option>
              <option value="INDIVIDUAL">{t.individual}</option>
              <option value="DEALER">{t.dealers}</option>
            </select>
            <select name="publisherSlug" defaultValue={publisherSlug} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.dealerSlug}</option>
              {dealers.map((dealer) => (
                <option key={dealer.id} value={dealer.slug}>{dealer.name}</option>
              ))}
            </select>
            <select name="verifiedOnly" defaultValue={verifiedOnly ? "true" : ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.verifiedOnly}</option>
              <option value="true">{t.verifiedOnly}</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="newest">{t.newest}</option>
              <option value="price_asc">{t.priceAsc}</option>
              <option value="price_desc">{t.priceDesc}</option>
            </select>
            <input name="priceMin" defaultValue={filters.priceMin ?? ""} placeholder={t.priceMin} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <input name="priceMax" defaultValue={filters.priceMax ?? ""} placeholder={t.priceMax} className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
              <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950">{t.apply}</button>
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
                <p className="text-xs text-zinc-400">{listing.make} {listing.model}</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{listing.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{listing.description}</p>
                <p className="mt-3 text-sm text-cyan-200">{formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.year} - {listing.mileageKm.toLocaleString(locale)} {t.km}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.city}, {listing.country}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                        {listing.publisherId ? t.dealerBadge : t.individualBadge}
                      </span>
                      {listing.publisher ? <span>{listing.publisher.name}</span> : null}
                      {listing.publisher?.verified ? <span className="text-cyan-300">{t.verified}</span> : null}
                    </span>
                  </p>
                  <Link href={`/auto/${listing.id}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
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
