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
  sort?: string;
};

function parseIntQuery(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
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

  const sort = filters.sort === "price_asc" || filters.sort === "price_desc" ? filters.sort : "newest";
  const orderBy =
    sort === "price_asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price_desc"
      ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

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
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
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
    mine: locale === "fr" ? "Mes annonces" : "My listings",
    login: locale === "fr" ? "Se connecter" : "Sign in",
    details: locale === "fr" ? "Voir" : "View",
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
              Stores
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
              <option value="">Type</option>
              <option value="SALE">SALE</option>
              <option value="RENT">RENT</option>
            </select>
            <select name="propertyType" defaultValue={propertyType ?? ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">Property</option>
              <option value="APARTMENT">APARTMENT</option>
              <option value="HOUSE">HOUSE</option>
              <option value="LAND">LAND</option>
              <option value="COMMERCIAL">COMMERCIAL</option>
              <option value="OTHER">OTHER</option>
            </select>
            <input name="city" defaultValue={filters.city ?? ""} placeholder="City" className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="country" defaultValue={filters.country ?? ""} placeholder="Country" className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="minPrice" defaultValue={filters.minPrice ?? ""} placeholder="Min price" className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="maxPrice" defaultValue={filters.maxPrice ?? ""} placeholder="Max price" className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="minSurface" defaultValue={filters.minSurface ?? ""} placeholder="Min m?" className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <input name="maxSurface" defaultValue={filters.maxSurface ?? ""} placeholder="Max m?" className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
              <button className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950">OK</button>
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
                <p className="text-xs text-zinc-400">{listing.listingType} ? {listing.propertyType}</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{listing.title}</h2>
                <p className="mt-2 text-sm text-zinc-300 line-clamp-3">{listing.description}</p>
                <p className="mt-3 text-sm text-emerald-200">{formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.surfaceM2} m? ? {listing.rooms ?? "-"} rooms</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.city}, {listing.country}</p>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">{listing.owner.name ?? "JONTAADO"}</p>
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
