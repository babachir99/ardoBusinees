/* eslint-disable @next/next/no-img-element */

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import ImmoMyDashboard from "@/components/immo/ImmoMyDashboard";
import type {
  ImmoMyDashboardData,
  getImmoAgenciesData,
  getImmoExplorerData,
} from "@/lib/immoStorefront";

type ImmoExplorerData = Awaited<ReturnType<typeof getImmoExplorerData>>;
type ImmoAgenciesData = Awaited<ReturnType<typeof getImmoAgenciesData>>;

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

export function ImmoExplorerSection({
  locale,
  basePath,
  data,
}: {
  locale: string;
  basePath: string;
  data: ImmoExplorerData;
}) {
  const isFr = locale === "fr";
  const now = new Date(data.nowIso);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              {isFr ? "Explorer" : "Explore"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {isFr ? "Toutes les annonces IMMO" : "All IMMO listings"}
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            {data.listings.length} {isFr ? "annonce(s)" : "listing(s)"}
          </span>
        </div>

        <form action={basePath} className="grid gap-2 md:grid-cols-4">
          <select
            name="listingType"
            defaultValue={data.filters.listingType}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Type" : "Type"}</option>
            <option value="SALE">{isFr ? "Vente" : "Sale"}</option>
            <option value="RENT">{isFr ? "Location" : "Rent"}</option>
          </select>
          <select
            name="propertyType"
            defaultValue={data.filters.propertyType}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Bien" : "Property"}</option>
            <option value="APARTMENT">{isFr ? "Appartement" : "Apartment"}</option>
            <option value="HOUSE">{isFr ? "Maison" : "House"}</option>
            <option value="LAND">{isFr ? "Terrain" : "Land"}</option>
            <option value="COMMERCIAL">{isFr ? "Commercial" : "Commercial"}</option>
            <option value="OTHER">{isFr ? "Autre" : "Other"}</option>
          </select>
          <input
            name="city"
            defaultValue={data.filters.city}
            placeholder={isFr ? "Ville" : "City"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="country"
            defaultValue={data.filters.country}
            placeholder={isFr ? "Pays" : "Country"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="minPrice"
            defaultValue={data.filters.minPrice}
            placeholder={isFr ? "Prix min" : "Min price"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="maxPrice"
            defaultValue={data.filters.maxPrice}
            placeholder={isFr ? "Prix max" : "Max price"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="minSurface"
            defaultValue={data.filters.minSurface}
            placeholder={isFr ? "Surface min (m2)" : "Min surface (m2)"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="maxSurface"
            defaultValue={data.filters.maxSurface}
            placeholder={isFr ? "Surface max (m2)" : "Max surface (m2)"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <select
            name="publisherType"
            defaultValue={data.filters.publisherType}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Particuliers / Agences" : "Individuals / Agencies"}</option>
            <option value="INDIVIDUAL">{isFr ? "Particuliers" : "Individuals"}</option>
            <option value="AGENCY">{isFr ? "Agences" : "Agencies"}</option>
          </select>
          <select
            name="verifiedOnly"
            defaultValue={data.filters.verifiedOnly ? "true" : ""}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Agences verifiees" : "Verified agencies"}</option>
            <option value="true">{isFr ? "Agences verifiees" : "Verified agencies"}</option>
          </select>
          <select
            name="sort"
            defaultValue={data.filters.sort}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="newest">{isFr ? "Plus recentes" : "Newest"}</option>
            <option value="price_asc">{isFr ? "Prix croissant" : "Price asc"}</option>
            <option value="price_desc">{isFr ? "Prix decroissant" : "Price desc"}</option>
          </select>
          <div className="flex gap-2 md:col-span-2">
            <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950">
              {isFr ? "Appliquer" : "Apply"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.listings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
            {isFr
              ? "Aucune annonce IMMO publiee pour ces filtres."
              : "No published IMMO listing for these filters."}
          </div>
        ) : (
          data.listings.map((listing) => (
            <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-zinc-400">
                  {listingTypeLabel(locale, listing.listingType)} - {propertyTypeLabel(locale, listing.propertyType)}
                </p>
                {listing.featuredUntil && new Date(listing.featuredUntil) > now ? (
                  <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                    {isFr ? "Mis en avant" : "Featured"}
                  </span>
                ) : null}
                {listing.boostUntil && new Date(listing.boostUntil) > now ? (
                  <span className="rounded-full border border-sky-300/40 bg-sky-300/15 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                    Boost
                  </span>
                ) : null}
              </div>
              {listing.imageUrls[0] ? (
                <img
                  src={listing.imageUrls[0]}
                  alt={listing.title}
                  className="mt-3 h-40 w-full rounded-xl border border-white/10 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="mt-3 h-40 w-full rounded-xl border border-dashed border-white/15 bg-zinc-950/40" />
              )}
              <h3 className="mt-3 text-lg font-semibold text-white">{listing.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-300">{listing.description}</p>
              <p className="mt-3 text-sm text-cyan-200">
                {formatMoney(listing.priceCents, listing.currency, locale)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {listing.surfaceM2} m2 - {listing.rooms ?? "-"} {isFr ? "pieces" : "rooms"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {listing.city}, {listing.country}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">{listing.publisher?.name ?? "JONTAADO"}</p>
                <Link
                  href={`/immo/${listing.id}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                >
                  {isFr ? "Voir" : "View"}
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export function ImmoAgenciesSection({
  locale,
  basePath,
  data,
}: {
  locale: string;
  basePath: string;
  data: ImmoAgenciesData;
}) {
  const isFr = locale === "fr";

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              {isFr ? "Agences" : "Agencies"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {isFr ? "Reseau agences IMMO" : "IMMO agency network"}
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            {data.agencies.length} {isFr ? "profil(s)" : "profile(s)"}
          </span>
        </div>

        <form action={basePath} className="grid gap-2 md:grid-cols-4">
          <input
            name="agencyCity"
            defaultValue={data.filters.agencyCity}
            placeholder={isFr ? "Ville" : "City"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="agencyCountry"
            defaultValue={data.filters.agencyCountry}
            placeholder={isFr ? "Pays" : "Country"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <select
            name="agencyVerified"
            defaultValue={data.filters.agencyVerified ? "true" : ""}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Verifiees seulement" : "Verified only"}</option>
            <option value="true">{isFr ? "Verifiees seulement" : "Verified only"}</option>
          </select>
          <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950">
            {isFr ? "Filtrer" : "Filter"}
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.agencies.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
            {isFr ? "Aucune agence trouvee." : "No agencies found."}
          </div>
        ) : (
          data.agencies.map((agency) => (
            <article key={agency.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
              <div className="flex items-center gap-3">
                {agency.logoUrl ? (
                  <img
                    src={agency.logoUrl}
                    alt={agency.name}
                    className="h-12 w-12 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-sm font-semibold text-zinc-200">
                    {(agency.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-white">{agency.name}</h3>
                  <p className="text-xs text-zinc-400">
                    {agency.city ?? "-"}, {agency.country ?? "-"}
                  </p>
                </div>
              </div>
              {agency.verified ? (
                <span className="mt-3 inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100">
                  {isFr ? "Verifiee" : "Verified"}
                </span>
              ) : null}
              <div className="mt-4">
                <Link
                  href={`/immo/agences/${agency.slug}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                >
                  {isFr ? "Voir le profil" : "View profile"}
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export function ImmoMySection({
  locale,
  loginHref,
  data,
}: {
  locale: string;
  loginHref: string;
  data: ImmoMyDashboardData | null;
}) {
  const isFr = locale === "fr";

  if (!data) {
    return (
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <p className="text-sm text-zinc-300">
          {isFr
            ? "Connecte-toi pour retrouver tes annonces, tes credits et ton espace IMMO."
            : "Sign in to manage your listings, credits and IMMO space."}
        </p>
        <div className="mt-4">
          <Link
            href={loginHref}
            className="inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white"
          >
            {isFr ? "Se connecter" : "Sign in"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {!data.canPublish ? (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-xs text-amber-100">
          {isFr
            ? "Publication reservee aux roles SELLER ou IMMO_AGENT."
            : "Publishing requires SELLER or IMMO_AGENT role."}
        </div>
      ) : null}

      <ImmoMyDashboard
        locale={locale}
        listings={data.listings}
        recentPurchases={data.recentPurchases}
        agencies={data.agencies}
      />
    </div>
  );
}

