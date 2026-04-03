import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceActions from "@/components/marketplace/MarketplaceActions";
import MarketplaceCard from "@/components/marketplace/MarketplaceCard";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import GpTripPublishModal from "@/components/gp/GpTripPublishModal";
import GpTripCard from "@/components/gp/GpTripCard";
import { resolveGpPublishAccess } from "@/components/gp/gpPublishAccess";
import { hasAnyUserRole } from "@/lib/userRoles";
import { Vertical, getVerticalRules } from "@/lib/verticals";

const currencyLabelMap: Record<string, string> = {
  XOF: "FCFA",
  EUR: "EUR",
  USD: "$",
};

const allowedCurrencies = new Set(["XOF", "EUR", "USD"]);

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
    prisma.store.findUnique({
      where: { slug: "jontaado-gp" },
      select: { id: true, name: true, description: true },
    }),
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

  const where: Record<string, unknown> = {
    storeId: store.id,
    isActive: true,
    status: "OPEN",
  };

  if (normalizedFrom) {
    where.originCity = { contains: normalizedFrom, mode: "insensitive" };
  }

  if (normalizedTo) {
    where.destinationCity = { contains: normalizedTo, mode: "insensitive" };
  }

  if (normalizedDepartureDate) {
    const start = new Date(`${normalizedDepartureDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.flightDate = { gte: start, lt: end };
    }
  }

  if (selectedCurrency !== "ALL") {
    where.currency = selectedCurrency;

    if (hasMinPrice || hasMaxPrice) {
      where.pricePerKgCents = {
        ...(hasMinPrice ? { gte: Math.trunc(parsedMinPrice) } : {}),
        ...(hasMaxPrice ? { lte: Math.trunc(parsedMaxPrice) } : {}),
      };
    }
  }

  const [trips, totalTrips, activeTransporters, myBookings] = await Promise.all([
    prisma.gpTrip.findMany({
      where,
      orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
      include: {
        transporter: {
          select: {
            id: true,
            name: true,
            phone: true,
            transporterRating: true,
            transporterReviewCount: true,
          },
        },
      },
      take: 60,
    }),
    prisma.gpTrip.count({
      where: { storeId: store.id, isActive: true, status: "OPEN" },
    }),
    prisma.gpTrip.findMany({
      where: { storeId: store.id, isActive: true, status: "OPEN" },
      distinct: ["transporterId"],
      select: { transporterId: true },
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
  ]);

  const bookingStatusByTrip = new Map(myBookings.map((booking) => [booking.tripId, booking.status]));
  const publishAccess = resolveGpPublishAccess(viewer, Boolean(session?.user?.id));
  const gpRules = getVerticalRules(Vertical.GP);
  const canOpenTransporterDashboard = hasAnyUserRole(session?.user, gpRules.publishRoles);

  const avgPriceValue =
    trips.length > 0 ? Math.round(trips.reduce((acc, trip) => acc + trip.pricePerKgCents, 0) / trips.length) : null;
  const avgCurrencyLabel = selectedCurrency !== "ALL" ? currencyLabelMap[selectedCurrency] : null;

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          badge="JONTAADO GP"
          title={locale === "fr" ? "Transport de colis par voyageurs" : "Parcel transport by travelers"}
          subtitle={
            locale === "fr"
              ? "Cherchez un trajet disponible selon ville, date de depart et budget, puis publiez vos propres capacites en quelques clics."
              : "Search available trips by city, departure date and budget, then publish your own capacity in a few clicks."
          }
          accentClassName="from-indigo-500/18 via-zinc-950/92 to-zinc-950"
          primaryAction={
            <a
              href="#gp-search"
              className="inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-300"
            >
              {locale === "fr" ? "Explorer les trajets" : "Explore trips"}
            </a>
          }
          secondaryAction={
            canOpenTransporterDashboard ? (
              <Link
                href="/transporter"
                className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 transition duration-200 hover:scale-[1.02] hover:border-indigo-300/35 hover:bg-white/10"
              >
                {locale === "fr" ? "Ouvrir le dashboard GP" : "Open GP dashboard"}
              </Link>
            ) : null
          }
          metrics={[
            { value: String(totalTrips), label: locale === "fr" ? "Annonces actives" : "Active listings" },
            { value: String(activeTransporters.length), label: locale === "fr" ? "Transporteurs actifs" : "Active transporters" },
            {
              value: avgPriceValue !== null && avgCurrencyLabel ? `${avgPriceValue} ${avgCurrencyLabel}` : "-",
              label: locale === "fr" ? "Prix moyen" : "Average price",
            },
          ]}
        />

        <MarketplaceActions
          left={
            canOpenTransporterDashboard ? (
              <Link
                href="/transporter"
                className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02]"
              >
                {locale === "fr" ? "Dashboard GP" : "GP dashboard"}
              </Link>
            ) : (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200">
                {locale === "fr" ? "Explorer GP" : "Explore GP"}
              </span>
            )
          }
          right={
            <a
              href="#gp-publish"
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/35 hover:bg-white/10"
            >
              {locale === "fr" ? "Publier un trajet" : "Publish trip"}
            </a>
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
      </main>
      <Footer />
    </div>
  );
}

