/* eslint-disable @next/next/no-img-element */

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import CarsMyDashboard from "@/components/cars/CarsMyDashboard";
import type {
  CarsMyDashboardData,
  getCarsDealersData,
  getCarsExplorerData,
} from "@/lib/carsStorefront";

type CarsExplorerData = Awaited<ReturnType<typeof getCarsExplorerData>>;
type CarsDealersData = Awaited<ReturnType<typeof getCarsDealersData>>;

export function CarsExplorerSection({
  locale,
  basePath,
  data,
}: {
  locale: string;
  basePath: string;
  data: CarsExplorerData;
}) {
  const isFr = locale === "fr";
  const now = new Date(data.nowIso);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              {isFr ? "Exploration" : "Explore"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {isFr ? "Toutes les annonces voitures" : "All car listings"}
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            {data.listings.length} {isFr ? "annonce(s)" : "listing(s)"}
          </span>
        </div>

        <form action={basePath} className="grid gap-2 md:grid-cols-4">
          <input
            name="country"
            defaultValue={data.filters.country}
            placeholder={isFr ? "Pays" : "Country"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="city"
            defaultValue={data.filters.city}
            placeholder={isFr ? "Ville" : "City"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="make"
            defaultValue={data.filters.make}
            placeholder={isFr ? "Marque" : "Make"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="model"
            defaultValue={data.filters.model}
            placeholder={isFr ? "Modele" : "Model"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="yearMin"
            defaultValue={data.filters.yearMin}
            placeholder={isFr ? "Annee min" : "Min year"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="yearMax"
            defaultValue={data.filters.yearMax}
            placeholder={isFr ? "Annee max" : "Max year"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="mileageMax"
            defaultValue={data.filters.mileageMax}
            placeholder={isFr ? "Km max" : "Max km"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <select
            name="fuelType"
            defaultValue={data.filters.fuelType}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Carburant" : "Fuel"}</option>
            <option value="GASOLINE">Gasoline</option>
            <option value="DIESEL">Diesel</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ELECTRIC">Electric</option>
            <option value="LPG">LPG</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            name="gearbox"
            defaultValue={data.filters.gearbox}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Boite" : "Gearbox"}</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTO">Auto</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            name="publisherType"
            defaultValue={data.filters.publisherType}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Particuliers / Concessionnaires" : "Individuals / Dealers"}</option>
            <option value="INDIVIDUAL">{isFr ? "Particulier" : "Individual"}</option>
            <option value="DEALER">{isFr ? "Concessionnaires" : "Dealers"}</option>
          </select>
          <select
            name="publisherSlug"
            defaultValue={data.filters.publisherSlug}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Concessionnaire" : "Dealer"}</option>
            {data.dealers.map((dealer) => (
              <option key={dealer.id} value={dealer.slug}>
                {dealer.name}
              </option>
            ))}
          </select>
          <select
            name="verifiedOnly"
            defaultValue={data.filters.verifiedOnly ? "true" : ""}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Concessionnaires verifies" : "Verified dealers"}</option>
            <option value="true">{isFr ? "Concessionnaires verifies" : "Verified dealers"}</option>
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
          <input
            name="priceMin"
            defaultValue={data.filters.priceMin}
            placeholder={isFr ? "Prix min" : "Min price"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              name="priceMax"
              defaultValue={data.filters.priceMax}
              placeholder={isFr ? "Prix max" : "Max price"}
              className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
            />
            <button className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-zinc-950">
              {isFr ? "Appliquer" : "Apply"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.listings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
            {isFr
              ? "Aucune annonce voiture publiee pour ces filtres."
              : "No published car listing for these filters."}
          </div>
        ) : (
          data.listings.map((listing) => (
            <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
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
              <p className="mt-3 text-xs text-zinc-400">
                {listing.make} {listing.model}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">{listing.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{listing.description}</p>
              <p className="mt-3 text-sm text-rose-200">
                {formatMoney(listing.priceCents, listing.currency, locale)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {listing.year} - {listing.mileageKm.toLocaleString(locale)} km
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {listing.city}, {listing.country}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                      {listing.publisherId
                        ? isFr
                          ? "Concessionnaire"
                          : "Dealer"
                        : isFr
                          ? "Particulier"
                          : "Individual"}
                    </span>
                    {listing.publisher ? <span>{listing.publisher.name}</span> : null}
                    {listing.publisher?.verified ? (
                      <span className="text-rose-200">{isFr ? "Verifie" : "Verified"}</span>
                    ) : null}
                    {listing.featuredUntil && new Date(listing.featuredUntil) > now ? (
                      <span className="text-amber-300">{isFr ? "Mis en avant" : "Featured"}</span>
                    ) : null}
                    {listing.boostUntil && new Date(listing.boostUntil) > now ? (
                      <span className="text-fuchsia-300">{isFr ? "Boost" : "Boost"}</span>
                    ) : null}
                  </span>
                </p>
                <Link
                  href={`/cars/${listing.id}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                >
                  {isFr ? "Voir" : "View"}
                </Link>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              {isFr ? "SHOP vehicules" : "SHOP vehicles"}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {isFr ? "Produits vehicules associes" : "Related vehicle products"}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {isFr
                ? "Produits e-commerce publies dans les categories vehicules."
                : "E-commerce products published in vehicle categories."}
            </p>
          </div>
        </div>

        {data.shopVehicleProducts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">
            {isFr
              ? "Aucun produit SHOP vehicule correspondant pour le moment."
              : "No matching SHOP vehicle products for now."}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.shopVehicleProducts.map((product) => (
              <article key={product.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-rose-300/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-100">
                    SHOP
                  </span>
                  <p className="text-xs text-zinc-500">
                    {new Date(product.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-white">{product.title}</h3>
                {product.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-zinc-300">{product.description}</p>
                ) : null}
                <p className="mt-3 text-sm text-rose-200">
                  {formatMoney(product.priceCents, product.currency, locale)}
                </p>
                {product.pickupLocation ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    {isFr ? "Retrait" : "Pickup"}: {product.pickupLocation}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/shop/${product.slug}`}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                  >
                    {isFr ? "Voir produit" : "View product"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CarsDealersSection({
  locale,
  basePath,
  data,
}: {
  locale: string;
  basePath: string;
  data: CarsDealersData;
}) {
  const isFr = locale === "fr";

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              {isFr ? "Concessionnaires" : "Dealers"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {isFr ? "Reseau concessionnaires CARS" : "CARS dealer network"}
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            {data.dealers.length} {isFr ? "profil(s)" : "profile(s)"}
          </span>
        </div>

        <form action={basePath} className="grid gap-2 md:grid-cols-4">
          <input type="hidden" name="tab" value="dealers" />
          <input
            name="dealerCountry"
            defaultValue={data.filters.dealerCountry}
            placeholder={isFr ? "Pays" : "Country"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <input
            name="dealerCity"
            defaultValue={data.filters.dealerCity}
            placeholder={isFr ? "Ville" : "City"}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          />
          <select
            name="dealerVerified"
            defaultValue={data.filters.dealerVerified ? "true" : ""}
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
          >
            <option value="">{isFr ? "Verifies seulement" : "Verified only"}</option>
            <option value="true">{isFr ? "Verifies seulement" : "Verified only"}</option>
          </select>
          <button className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-zinc-950">
            {isFr ? "Appliquer" : "Apply"}
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {data.dealers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
            {isFr ? "Aucun concessionnaire trouve." : "No dealer found."}
          </div>
        ) : (
          data.dealers.map((dealer) => (
            <article key={dealer.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
              <h3 className="text-lg font-semibold text-white">{dealer.name}</h3>
              <p className="mt-1 text-xs text-zinc-400">
                {dealer.city ?? "-"}, {dealer.country ?? "-"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {dealer._count.listings} {isFr ? "annonces" : "listings"}
              </p>
              {dealer.verified ? (
                <span className="mt-2 inline-flex rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-[10px] font-semibold text-rose-100">
                  {isFr ? "Verifie" : "Verified"}
                </span>
              ) : null}
              <div className="mt-4">
                <Link
                  href={`/cars/dealers/${dealer.slug}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                >
                  {isFr ? "Voir vitrine" : "View storefront"}
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export function CarsMySection({
  locale,
  data,
}: {
  locale: string;
  data: CarsMyDashboardData | null;
}) {
  const isFr = locale === "fr";

  if (!data) {
    return (
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
          {isFr ? "Mes annonces" : "My listings"}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {isFr ? "Connecte-toi pour gerer tes annonces" : "Sign in to manage your listings"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          {isFr
            ? "Retrouve tes annonces, publie de nouveaux vehicules et gere tes concessions sans quitter JONTAADO CARS."
            : "Access your listings, publish vehicles and manage your dealerships without leaving JONTAADO CARS."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/login?callbackUrl=/${locale}/stores/jontaado-cars?tab=my`}
            className="rounded-full bg-rose-400 px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            {isFr ? "Se connecter" : "Sign in"}
          </Link>
        </div>
      </section>
    );
  }

  return <CarsMyDashboard locale={locale} {...data} />;
}
