import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import GpTripPublishModal from "@/components/gp/GpTripPublishModal";
import GpTripReviewForm from "@/components/gp/GpTripReviewForm";

const paymentMethodMeta: Record<string, { fr: string; en: string; icon: string }> = {
  WAVE: { fr: "Wave", en: "Wave", icon: "W" },
  ORANGE_MONEY: { fr: "Orange Money", en: "Orange Money", icon: "OM" },
  CARD: { fr: "Carte", en: "Card", icon: "CARD" },
  CASH: { fr: "Especes", en: "Cash", icon: "CASH" },
};

const currencyLabelMap: Record<string, string> = {
  XOF: "FCFA",
  EUR: "€",
  USD: "$",
};

const allowedCurrencies = new Set(["XOF", "EUR", "USD"]);

function formatDateTime(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDateOnly(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
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
    prisma.store.findUnique({
      where: { slug: "jontaado-gp" },
      select: { id: true, name: true, description: true },
    }),
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, phone: true, role: true },
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

  const [trips, totalTrips, activeTransporters] = await Promise.all([
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
  ]);

  const canPublish = viewer?.role === "TRANSPORTER" || viewer?.role === "ADMIN";

  const avgPriceValue =
    trips.length > 0 ? Math.round(trips.reduce((acc, trip) => acc + trip.pricePerKgCents, 0) / trips.length) : null;
  const avgCurrencyLabel = selectedCurrency !== "ALL" ? currencyLabelMap[selectedCurrency] : null;

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[115px] w-auto md:h-[135px]"
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          {canPublish && (
            <Link
              href="/transporter"
              className="rounded-full border border-cyan-300/40 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/80"
            >
              {locale === "fr" ? "Mon dashboard GP" : "My GP dashboard"}
            </Link>
          )}
          <Link
            href="/stores"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {locale === "fr" ? "Retour aux boutiques" : "Back to stores"}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Annonces actives" : "Active listings"}
            </p>
            <p className="mt-2 text-xl font-semibold text-violet-200">{totalTrips}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Transporteurs actifs" : "Active transporters"}
            </p>
            <p className="mt-2 text-xl font-semibold text-violet-200">{activeTransporters.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Prix moyen" : "Average price"}
            </p>
            <p className="mt-2 text-xl font-semibold text-violet-200">
              {avgPriceValue !== null && avgCurrencyLabel ? `${avgPriceValue} ${avgCurrencyLabel}` : "-"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-400/20 via-zinc-900/90 to-zinc-950 p-5 shadow-[0_20px_80px_-40px_rgba(99,102,241,0.6)] md:p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">JONTAADO GP</p>
            <h1 className="text-2xl font-semibold md:text-4xl">
              {locale === "fr"
                ? "Transport de colis par voyageurs"
                : "Parcel transport by travelers"}
            </h1>
            <p className="max-w-3xl text-sm text-zinc-300 md:text-base">
              {locale === "fr"
                ? "Cherchez un trajet disponible selon ville, date de depart et budget par devise."
                : "Search available trips by cities, departure date and budget by currency."}
            </p>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.95fr_0.8fr_0.8fr_0.8fr_auto]" method="GET">
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
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-zinc-900/60 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <h2 className="text-base font-semibold text-white md:text-lg">
              {locale === "fr" ? "Publier un nouveau trajet" : "Publish a new trip"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {locale === "fr"
                ? "Definis les dates et le tarif dans ta devise, sans conversion automatique."
                : "Set dates and price in your chosen currency, without automatic conversion."}
            </p>
          </div>
          <GpTripPublishModal
            locale={locale}
            canPublish={Boolean(canPublish)}
            defaultContactPhone={viewer?.phone}
          />
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
            const tripCurrency = allowedCurrencies.has(trip.currency) ? trip.currency : "XOF";
            const tripCurrencyLabel = currencyLabelMap[tripCurrency] ?? "FCFA";

            return (
              <article
                key={trip.id}
                className="group rounded-3xl border border-white/10 bg-zinc-900/70 p-5 transition hover:border-indigo-300/30 hover:bg-zinc-900/90"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mt-1 text-base font-semibold text-white">
                      {trip.originCity} {"->"} {trip.destinationCity}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {locale === "fr" ? "Depart" : "Departure"}: {formatDateOnly(locale, trip.flightDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-medium text-cyan-100">
                    {trip.availableKg} kg {locale === "fr" ? "dispo" : "available"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-zinc-950/60 p-3 text-xs text-zinc-300">
                  <p>
                    <span className="text-zinc-400">{locale === "fr" ? "Date de depart:" : "Departure date:"}</span>{" "}
                    {formatDateOnly(locale, trip.flightDate)}
                  </p>
                  <p>
                    <span className="text-zinc-400">{locale === "fr" ? "Depart:" : "Departure:"}</span>{" "}
                    {trip.originAddress}
                  </p>
                  <p>
                    <span className="text-zinc-400">{locale === "fr" ? "Arrivee:" : "Arrival:"}</span>{" "}
                    {trip.destinationAddress}
                  </p>
                  {trip.deliveryEndAt && (
                    <p>
                      <span className="text-zinc-400">{locale === "fr" ? "Date d'arrivee:" : "Arrival date:"}</span>{" "}
                      {formatDateOnly(locale, trip.deliveryEndAt)}
                    </p>
                  )}
                  {trip.deliveryStartAt && (
                    <p>
                      <span className="text-zinc-400">{locale === "fr" ? "Debut livraison:" : "Delivery start:"}</span>{" "}
                      {formatDateTime(locale, trip.deliveryStartAt)}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-300">
                    {locale === "fr" ? "Tarif" : "Price"}{" "}
                    <span className="text-base font-semibold text-emerald-200">
                      {trip.pricePerKgCents} {tripCurrencyLabel}
                    </span>
                  </p>
                  {trip.maxPackages && (
                    <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-300">
                      {locale === "fr" ? "Max colis" : "Max parcels"}: {trip.maxPackages}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {trip.acceptedPaymentMethods.map((method) => {
                    const methodMeta = paymentMethodMeta[method] ?? {
                      fr: method,
                      en: method,
                      icon: "?",
                    };
                    return (
                      <span
                        key={method}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100"
                      >
                        <span className="text-[10px]">{methodMeta.icon}</span>
                        {locale === "fr" ? methodMeta.fr : methodMeta.en}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-white/10 pt-3 text-xs text-zinc-400">
                  <p>
                    {locale === "fr" ? "Transporteur" : "Transporter"}: {trip.transporter.name ?? "-"}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-200">
                    ? {trip.transporter.transporterRating.toFixed(1)} ({trip.transporter.transporterReviewCount})
                  </p>
                  {(trip.contactPhone || trip.transporter.phone) && (
                    <p className="mt-1">
                      {locale === "fr" ? "Contact" : "Contact"}: {trip.contactPhone ?? trip.transporter.phone}
                    </p>
                  )}
                  <Link
                    href={`/transporters/${trip.transporter.id}`}
                    className="mt-2 inline-flex rounded-full border border-white/15 px-3 py-1 text-[11px] text-zinc-200 transition hover:border-cyan-300/60"
                  >
                    {locale === "fr" ? "Voir le profil transporteur" : "View transporter profile"}
                  </Link>
                  {trip.notes && <p className="mt-2">{trip.notes}</p>}
                </div>

                <GpTripReviewForm
                  tripId={trip.id}
                  locale={locale}
                  isLoggedIn={Boolean(session?.user?.id)}
                  isOwner={session?.user?.id === trip.transporterId}
                />
              </article>
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

