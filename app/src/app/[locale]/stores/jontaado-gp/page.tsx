import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import MarketplaceAdRequestButton from "@/components/ads/MarketplaceAdRequestButton";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceHeroDynamicTitle from "@/components/marketplace/MarketplaceHeroDynamicTitle";
import {
  marketplaceActionPrimaryClass,
  marketplaceActionSecondaryClass,
} from "@/components/marketplace/MarketplaceActions";
import MarketplaceActions from "@/components/marketplace/MarketplaceActions";
import MarketplaceCard from "@/components/marketplace/MarketplaceCard";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import GpTripPublishModal from "@/components/gp/GpTripPublishModal";
import GpTripCard from "@/components/gp/GpTripCard";
import { resolveGpPublishAccess } from "@/components/gp/gpPublishAccess";
import { hasAnyUserRole } from "@/lib/userRoles";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { getGpMarketplaceSnapshot, getGpStoreSnapshot } from "@/lib/gpSnapshots";
import { buildStoreMetadata } from "@/lib/storeSeo";

const allowedCurrencies = new Set(["XOF", "EUR", "USD"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: "/stores/jontaado-gp",
    title: isFr
      ? "JONTAADO GP | Trajets, expedition et transporteurs"
      : "JONTAADO GP | Trips, shipping and carriers",
    description: isFr
      ? "Explore les trajets GP, publie un trajet et expedie avec des transporteurs fiables sur JONTAADO."
      : "Explore GP trips, publish a route and ship with reliable carriers on JONTAADO.",
    imagePath: "/stores/gp.png",
  });
}

export default async function GpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    departureDate?: string;
    minPrice?: string;
    maxPrice?: string;
    currency?: string;
  }>;
}) {
  const [{ locale }, { from, to, departureDate, minPrice, maxPrice, currency }] = await Promise.all([
    params,
    searchParams,
  ]);
  const session = await getServerSession(authOptions);

  const [store, viewer] = await Promise.all([
    getGpStoreSnapshot(),
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            gpTrips: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { contactPhone: true, acceptedPaymentMethods: true },
            },
          },
        })
      : null,
  ]);

  if (!store) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
          <p className="text-sm text-zinc-300">
            {locale === "fr" ? "Boutique GP introuvable" : "GP store not found"}
          </p>
          <Link
            href="/stores"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Retour aux boutiques" : "Back to stores"}
          </Link>
        </div>
      </div>
    );
  }

  const normalizedFrom = from?.trim() ?? "";
  const normalizedTo = to?.trim() ?? "";
  const normalizedDepartureDate = departureDate?.trim() ?? "";
  const normalizedCurrencyRaw = currency?.trim().toUpperCase() ?? "ALL";
  const selectedCurrency = allowedCurrencies.has(normalizedCurrencyRaw) ? normalizedCurrencyRaw : "ALL";

  const parsedMinPrice = Number(minPrice ?? "");
  const parsedMaxPrice = Number(maxPrice ?? "");
  const hasMinPrice = Number.isFinite(parsedMinPrice) && parsedMinPrice > 0;
  const hasMaxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice > 0;

  const [marketplaceSnapshot, myBookings, featuredTransporters] = await Promise.all([
    getGpMarketplaceSnapshot(store.id, {
      from: normalizedFrom,
      to: normalizedTo,
      departureDate: normalizedDepartureDate,
      minPrice: hasMinPrice ? String(Math.trunc(parsedMinPrice)) : "",
      maxPrice: hasMaxPrice ? String(Math.trunc(parsedMaxPrice)) : "",
      currency: selectedCurrency,
    }),
    session?.user?.id
      ? prisma.gpTripBooking.findMany({
          where: {
            customerId: session.user.id,
            trip: { storeId: store.id },
          },
          select: { tripId: true, status: true },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: "TRANSPORTER" },
          {
            roleAssignments: {
              some: {
                role: { in: ["GP_CARRIER", "TRANSPORTER", "ADMIN"] },
                status: "ACTIVE",
              },
            },
          },
        ],
        gpTrips: {
          some: {
            isActive: true,
            status: "OPEN",
            storeId: store.id,
          },
        },
      },
      orderBy: [{ transporterRating: "desc" }, { transporterReviewCount: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        id: true,
        name: true,
        phone: true,
        transporterRating: true,
        transporterReviewCount: true,
        gpTrips: {
          where: {
            isActive: true,
            status: "OPEN",
            storeId: store.id,
          },
          orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            originCity: true,
            destinationCity: true,
            flightDate: true,
            availableKg: true,
          },
        },
      },
    }),
  ]);

  const trips = marketplaceSnapshot.trips.map((trip) => ({
    ...trip,
    flightDate: new Date(trip.flightDate),
    deliveryStartAt: trip.deliveryStartAt ? new Date(trip.deliveryStartAt) : null,
    deliveryEndAt: trip.deliveryEndAt ? new Date(trip.deliveryEndAt) : null,
  }));
  const bookingStatusByTrip = new Map(myBookings.map((booking) => [booking.tripId, booking.status]));
  const publishAccess = resolveGpPublishAccess(viewer, Boolean(session?.user?.id));
  const gpRules = getVerticalRules(Vertical.GP);
  const canOpenTransporterDashboard = hasAnyUserRole(session?.user, gpRules.publishRoles);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={
            <MarketplaceHeroDynamicTitle
              fixedLine={locale === "fr" ? "Trouve ou propose un trajet" : "Find or offer a trip"}
              lines={
                locale === "fr"
                  ? ["pour expedier sans stress", "avec des transporteurs fiables", "au bon budget", "sur des trajets qui comptent"]
                  : ["to ship without stress", "with trusted transporters", "at the right budget", "on trips that matter"]
              }
            />
          }
          compact
          accentClassName="from-indigo-500/18 via-zinc-950/92 to-zinc-950"
        />

        <MarketplaceActions
          left={
            <>
              <a
                href="#gp-search"
                className={marketplaceActionPrimaryClass}
              >
                {locale === "fr" ? "Explorer" : "Explore"}
              </a>
              <a
                href="#gp-publish"
                className={marketplaceActionSecondaryClass}
              >
                {locale === "fr" ? "Publier" : "Publish"}
              </a>
              <Link
                href="/stores/jontaado-gp/transporters"
                className={marketplaceActionSecondaryClass}
              >
                {locale === "fr" ? "Transporteurs" : "Carriers"}
              </Link>
              {session?.user?.id ? (
                <Link
                  href="/stores/jontaado-gp/bookings"
                  className={marketplaceActionSecondaryClass}
                >
                  {locale === "fr" ? "Mes reservations" : "My bookings"}
                </Link>
              ) : null}
              {canOpenTransporterDashboard ? (
                <Link
                  href="/stores/jontaado-gp/dashboard"
                  className={marketplaceActionSecondaryClass}
                >
                  {locale === "fr" ? "Dashboard" : "Dashboard"}
                </Link>
              ) : null}
              {session?.user?.id ? (
                <Link
                  href="/stores/jontaado-gp/shipments"
                  className={marketplaceActionSecondaryClass}
                >
                  {locale === "fr" ? "Shipments" : "Shipments"}
                </Link>
              ) : null}
            </>
          }
          right={
            <MarketplaceAdRequestButton
              locale={locale}
              sourceVertical="GP"
              label={locale === "fr" ? "Demander une pub" : "Request an ad"}
              className={marketplaceActionSecondaryClass}
            />
          }
        />

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <MarketplaceCard
            label={locale === "fr" ? "Recherche" : "Search"}
            title={locale === "fr" ? "Trouver le bon trajet" : "Find the right trip"}
            description={
              locale === "fr"
                ? "Filtrez par ville, date, devise et budget pour aller droit au bon transporteur."
                : "Filter by city, date, currency and budget to get straight to the right transporter."
            }
            className="rounded-[1.6rem] border border-white/10 bg-zinc-900/60 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-indigo-300/30 hover:shadow-[0_20px_60px_-32px_rgba(99,102,241,0.45)] motion-reduce:transition-none md:col-span-2 xl:col-span-2"
          >
            <form
              id="gp-search"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.95fr_0.8fr_0.8fr_0.8fr_auto]"
              method="GET"
            >
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {locale === "fr" ? "Depart" : "Departure"}
              </span>
              <input
                name="from"
                defaultValue={normalizedFrom}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
                placeholder={locale === "fr" ? "Ville de depart" : "Departure city"}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {locale === "fr" ? "Arrivee" : "Arrival"}
              </span>
              <input
                name="to"
                defaultValue={normalizedTo}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
                placeholder={locale === "fr" ? "Ville d'arrivee" : "Arrival city"}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {locale === "fr" ? "Date de depart" : "Departure date"}
              </span>
              <input
                type="date"
                name="departureDate"
                defaultValue={normalizedDepartureDate}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {locale === "fr" ? "Prix min" : "Min price"}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                name="minPrice"
                defaultValue={minPrice ?? ""}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {locale === "fr" ? "Prix max" : "Max price"}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                name="maxPrice"
                defaultValue={maxPrice ?? ""}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {locale === "fr" ? "Devise" : "Currency"}
              </span>
              <select
                name="currency"
                defaultValue={selectedCurrency}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
              >
                <option value="ALL">{locale === "fr" ? "Toutes" : "All"}</option>
                <option value="XOF">XOF / FCFA</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-400 to-cyan-400 px-4 text-sm font-semibold text-zinc-950 transition hover:brightness-110 md:w-auto md:min-w-28"
              >
                {locale === "fr" ? "Rechercher" : "Search"}
              </button>
            </div>
            </form>
          </MarketplaceCard>

          <MarketplaceCard
            label={locale === "fr" ? "Publication" : "Publishing"}
            title={locale === "fr" ? "Publier un nouveau trajet" : "Publish a new trip"}
            description={
              locale === "fr"
                ? "Definis les dates, le tarif et les moyens de paiement dans ta devise, sans surcharge."
                : "Set dates, price and payment methods in your own currency without extra clutter."
            }
            className="rounded-[1.6rem] border border-white/10 bg-zinc-900/60 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-indigo-300/30 hover:shadow-[0_20px_60px_-32px_rgba(99,102,241,0.45)] motion-reduce:transition-none"
          >
            <div id="gp-publish" className="flex flex-col gap-4">
              <p className="text-sm leading-6 text-zinc-400">
                {locale === "fr"
                  ? "Une seule entree claire pour proposer tes capacites et gerer tes reservations."
                  : "A single clear entry point to publish your capacity and manage bookings."}
              </p>
              <GpTripPublishModal
                locale={locale}
                isLoggedIn={publishAccess.isLoggedIn}
                hasGpProfile={publishAccess.hasGpProfile}
                gpDisplayName={publishAccess.displayName}
                defaultContactPhone={publishAccess.defaultContactPhone}
                defaultPaymentMethods={publishAccess.defaultPaymentMethods}
                profileHref="/profile"
              />
            </div>
          </MarketplaceCard>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white md:text-xl">
              {locale === "fr" ? "Trajets disponibles" : "Available trips"}
            </h2>
            <p className="text-xs text-zinc-400 md:text-sm">
              {trips.length} {locale === "fr" ? "resultat(s)" : "result(s)"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((trip) => {
            const bookingStatus = bookingStatusByTrip.get(trip.id) ?? null;

            return (
              <GpTripCard
                key={trip.id}
                locale={locale}
                trip={trip}
                bookingStatus={bookingStatus}
                isLoggedIn={Boolean(session?.user?.id)}
                viewerUserId={session?.user?.id}
              />
            );
          })}

          {trips.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
              {locale === "fr"
                ? "Aucune annonce GP active pour ce filtre."
                : "No active GP listings for this filter."}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white md:text-xl">
                {locale === "fr" ? "Transporteurs recommandes" : "Recommended carriers"}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {locale === "fr"
                  ? "Des profils solides pour t'aider a choisir plus vite."
                  : "Strong profiles to help you choose faster."}
              </p>
            </div>
            <Link
              href="/stores/jontaado-gp/transporters"
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-white/30"
            >
              {locale === "fr" ? "Tous les transporteurs" : "All carriers"}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {featuredTransporters.map((transporter) => {
            const nextTrip = transporter.gpTrips[0] ?? null;
            return (
              <article
                key={transporter.id}
                className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_12px_30px_rgba(2,6,23,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">JONTAADO GP</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {transporter.name ?? (locale === "fr" ? "Transporteur" : "Transporter")}
                    </h3>
                    <p className="mt-1 text-sm text-amber-200">
                      * {transporter.transporterRating.toFixed(1)} ({transporter.transporterReviewCount}{" "}
                      {locale === "fr" ? "avis" : "reviews"})
                    </p>
                  </div>
                  {nextTrip ? (
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100">
                      {nextTrip.availableKg} kg
                    </span>
                  ) : null}
                </div>

                {nextTrip ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-300">
                    <p className="font-semibold text-white">
                      {nextTrip.originCity} {"->"} {nextTrip.destinationCity}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
                        dateStyle: "medium",
                      }).format(nextTrip.flightDate)}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500">
                    {transporter.phone ?? (locale === "fr" ? "Contact via profil" : "Contact via profile")}
                  </p>
                  <Link
                    href={`/stores/jontaado-gp/transporters/${transporter.id}`}
                    className="rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:brightness-110"
                  >
                    {locale === "fr" ? "Voir le profil" : "View profile"}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </main>
      <Footer />
    </div>
  );
}

