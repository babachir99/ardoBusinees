import Image from "next/image";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import DashboardListExportButton from "@/components/dashboard/DashboardListExportButton";
import PartnerTrendsPanel from "@/components/dashboard/PartnerTrendsPanel";
import GpPendingBookingsPanel from "@/components/gp/GpPendingBookingsPanel";
import GpTripsManagerPanel from "@/components/gp/GpTripsManagerPanel";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { buildTrendPoints, toDayKey } from "@/lib/dashboard/trends";
import { formatMoney } from "@/lib/format";
import { buildStoreMetadata } from "@/lib/storeSeo";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { hasAnyUserRole } from "@/lib/userRoles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: "/transporter",
    title: isFr ? "Dashboard GP | Espace transporteur prive" : "GP dashboard | Private carrier space",
    description: isFr
      ? "Suis tes trajets, tes expeditions et tes gains depuis ton dashboard GP prive."
      : "Track trips, shipments and earnings from your private GP dashboard.",
    imagePath: "/stores/gp.png",
    noIndex: true,
  });
}

function formatDateOnly(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function TransporterDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const isFr = locale === "fr";
  const rules = getVerticalRules(Vertical.GP);
  const canAccess = hasAnyUserRole(session?.user, rules.publishRoles);

  if (!session?.user?.id || !canAccess) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {locale === "fr" ? "Acces transporteur requis" : "Transporter access required"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {locale === "fr"
                ? "Ce dashboard est reserve aux transporteurs GP."
                : "This dashboard is reserved for GP transporters."}
            </p>
            <Link
              href="/stores/jontaado-gp"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {locale === "fr" ? "Retour a GP" : "Back to GP"}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const today = startOfToday();
  const trendDays = 365;
  const trendStart = new Date(today);
  trendStart.setDate(trendStart.getDate() - (trendDays - 1));

  const [
    user,
    totalTrips,
    openTrips,
    totalKgAggregate,
    avgPriceAggregate,
    activeShipments,
    uniqueClientRows,
    bookedRows,
    trendRows,
    trips,
    recentReviews,
    recentClientBookings,
    pendingBookings,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        transporterRating: true,
        transporterReviewCount: true,
      },
    }),
    prisma.gpTrip.count({
      where: { transporterId: session.user.id },
    }),
    prisma.gpTrip.count({
      where: { transporterId: session.user.id, status: "OPEN" },
    }),
    prisma.gpTripBooking.aggregate({
      _sum: { requestedKg: true },
      where: {
        transporterId: session.user.id,
        status: { in: ["CONFIRMED", "COMPLETED", "DELIVERED"] },
      },
    }),
    prisma.gpTrip.aggregate({
      _avg: { pricePerKgCents: true },
      where: {
        transporterId: session.user.id,
        status: "OPEN",
      },
    }),
    prisma.gpShipment.count({
      where: {
        transporterId: session.user.id,
        status: { in: ["DROPPED_OFF", "PICKED_UP", "BOARDED", "ARRIVED"] },
      },
    }),
    prisma.gpTripBooking.findMany({
      where: {
        transporterId: session.user.id,
        status: { in: ["ACCEPTED", "CONFIRMED", "COMPLETED", "DELIVERED"] },
      },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
    prisma.gpTripBooking.findMany({
      where: {
        transporterId: session.user.id,
        status: { in: ["ACCEPTED", "CONFIRMED", "COMPLETED", "DELIVERED"] },
      },
      select: {
        id: true,
        status: true,
        requestedKg: true,
        customerId: true,
        createdAt: true,
        confirmedAt: true,
        completedAt: true,
        trip: {
          select: {
            pricePerKgCents: true,
            currency: true,
          },
        },
      },
    }),
    prisma.gpTripBooking.findMany({
      where: {
        transporterId: session.user.id,
        createdAt: { gte: trendStart },
        status: { in: ["CONFIRMED", "COMPLETED", "DELIVERED"] },
      },
      select: {
        id: true,
        customerId: true,
        requestedKg: true,
        createdAt: true,
        confirmedAt: true,
        completedAt: true,
        trip: {
          select: {
            pricePerKgCents: true,
            currency: true,
          },
        },
      },
    }),
    prisma.gpTrip.findMany({
      where: { transporterId: session.user.id },
      orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
      take: 12,
        select: {
          id: true,
          originCity: true,
          destinationCity: true,
          flightDate: true,
          availableKg: true,
          pricePerKgCents: true,
          currency: true,
          status: true,
          isActive: true,
          maxPackages: true,
          contactPhone: true,
          notes: true,
          acceptedPaymentMethods: true,
          createdAt: true,
        },
      }),
    prisma.transporterReview.findMany({
      where: { transporterId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
        trip: {
          select: {
            id: true,
            originCity: true,
            destinationCity: true,
            flightDate: true,
          },
        },
      },
    }),
    prisma.gpTripBooking.findMany({
      where: {
        transporterId: session.user.id,
        status: { in: ["ACCEPTED", "CONFIRMED", "COMPLETED", "DELIVERED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        requestedKg: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        trip: {
          select: {
            originCity: true,
            destinationCity: true,
            pricePerKgCents: true,
            currency: true,
          },
        },
      },
    }),
    prisma.gpTripBooking.findMany({
      where: {
        transporterId: session.user.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        tripId: true,
        requestedKg: true,
        packageCount: true,
        message: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
          },
        },
        trip: {
          select: {
            originCity: true,
            destinationCity: true,
            flightDate: true,
            currency: true,
            pricePerKgCents: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <p className="text-sm text-zinc-300">{locale === "fr" ? "Profil introuvable" : "Profile not found"}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const trendDates = buildTrendPoints(locale, trendStart, trendDays);
  const revenueByDay = Object.fromEntries(trendDates.map((point) => [point.key, 0])) as Record<string, number>;
  const bookingsByDay = Object.fromEntries(trendDates.map((point) => [point.key, 0])) as Record<string, number>;
  const clientSetsByDay = Object.fromEntries(
    trendDates.map((point) => [point.key, new Set<string>()])
  ) as Record<string, Set<string>>;

  for (const booking of trendRows) {
    const referenceDate = booking.completedAt ?? booking.confirmedAt ?? booking.createdAt;
    const key = toDayKey(referenceDate);
    if (!(key in bookingsByDay)) continue;
    bookingsByDay[key] += 1;
    clientSetsByDay[key]?.add(booking.customerId);
    revenueByDay[key] += booking.requestedKg * (booking.trip?.pricePerKgCents ?? 0);
  }

  let signedRevenueCents = 0;
  let pendingRevenueCents = 0;
  for (const booking of bookedRows) {
    const amount = booking.requestedKg * (booking.trip?.pricePerKgCents ?? 0);
    if (["CONFIRMED", "COMPLETED", "DELIVERED"].includes(booking.status)) {
      signedRevenueCents += amount;
    }
    if (["ACCEPTED", "CONFIRMED"].includes(booking.status)) {
      pendingRevenueCents += amount;
    }
  }

  const nextTrip = trips
    .filter((trip) => trip.status === "OPEN" && trip.flightDate >= new Date())
    .sort((a, b) => a.flightDate.getTime() - b.flightDate.getTime())[0];
  const displayCurrency = bookedRows[0]?.trip?.currency ?? nextTrip?.currency ?? "XOF";
  const uniqueClients = uniqueClientRows.length;
  const totalKg = totalKgAggregate._sum.requestedKg ?? 0;
  const averagePrice = Math.round(avgPriceAggregate._avg.pricePerKgCents ?? 0);

  const statCards = [
    { label: isFr ? "Trajets ouverts" : "Open trips", value: openTrips },
    { label: isFr ? "Colis en cours" : "Active shipments", value: activeShipments },
    { label: isFr ? "Clients actifs" : "Active clients", value: uniqueClients },
    { label: isFr ? "Kg confirmes" : "Confirmed kg", value: totalKg },
    { label: isFr ? "Gains signes" : "Signed revenue", value: formatMoney(signedRevenueCents, displayCurrency, locale) },
    { label: isFr ? "A livrer" : "Revenue in flight", value: formatMoney(pendingRevenueCents, displayCurrency, locale) },
  ];

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
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/stores/jontaado-gp"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {locale === "fr" ? "Voir GP" : "Go to GP"}
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {locale === "fr" ? "Profil" : "Profile"}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">JONTAADO GP</p>
          <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
            {locale === "fr" ? "Dashboard transporteur" : "Transporter dashboard"}
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            {locale === "fr"
              ? `Ravis de vous retrouver ${user.name ?? ""}. Suivez vos gains, vos colis et vos clients sur la duree.`
              : `Welcome back ${user.name ?? ""}. Track revenue, parcels and customers over time.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              Note {user.transporterRating.toFixed(1)} ({user.transporterReviewCount})
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {locale === "fr" ? "Trajets publies" : "Published trips"}: {totalTrips}
            </span>
            {user.phone ? (
              <span className="rounded-full border border-white/15 px-3 py-1">
                {locale === "fr" ? "Contact" : "Contact"}: {user.phone}
              </span>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
              <p className="text-[11px] text-zinc-400">{card.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </section>

        <GpPendingBookingsPanel
          locale={locale}
          bookings={pendingBookings.map((booking) => ({
            ...booking,
            createdAt: booking.createdAt.toISOString(),
            trip: {
              ...booking.trip,
              flightDate: booking.trip.flightDate.toISOString(),
            },
          }))}
        />

        <PartnerTrendsPanel
          locale={locale}
          title={locale === "fr" ? "Vue jour par jour" : "Day-by-day view"}
          subtitle={
            locale === "fr"
              ? "Observe le rythme des reservations, la signature de revenu et l'arrivee de nouveaux clients."
              : "See booking rhythm, signed revenue and new-client momentum."
          }
          dates={trendDates}
          metrics={[
            {
              key: "revenue",
              title: locale === "fr" ? "Gains signes" : "Signed revenue",
              color: "#34d399",
              series: trendDates.map((point) => revenueByDay[point.key] ?? 0),
              isMoney: true,
              moneyLabel: displayCurrency === "XOF" ? "FCFA" : displayCurrency,
            },
            {
              key: "bookings",
              title: locale === "fr" ? "Reservations" : "Bookings",
              color: "#38bdf8",
              series: trendDates.map((point) => bookingsByDay[point.key] ?? 0),
            },
            {
              key: "clients",
              title: locale === "fr" ? "Clients" : "Clients",
              color: "#f59e0b",
              series: trendDates.map((point) => clientSetsByDay[point.key]?.size ?? 0),
            },
          ]}
          rangeOptions={[7, 30, 90, 365]}
          defaultRange={30}
          exportFilename="gp-dashboard.csv"
        />

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/stores/jontaado-gp"
                className="rounded-full border border-cyan-300/40 px-3 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-300/80"
              >
                {locale === "fr" ? "Publier un nouveau trajet" : "Publish a new trip"}
              </Link>
              <DashboardListExportButton
                filename="gp-trips.csv"
                label={locale === "fr" ? "Exporter les trajets" : "Export trips"}
                disabledLabel={locale === "fr" ? "Aucun trajet" : "No trips"}
                columns={[
                  { key: "route", label: locale === "fr" ? "Trajet" : "Route" },
                  { key: "date", label: locale === "fr" ? "Date" : "Date" },
                  { key: "kg", label: "Kg" },
                  { key: "price", label: locale === "fr" ? "Prix" : "Price" },
                  { key: "status", label: locale === "fr" ? "Statut" : "Status" },
                ]}
                rows={trips.map((trip) => ({
                  route: `${trip.originCity} -> ${trip.destinationCity}`,
                  date: formatDateOnly(locale, trip.flightDate),
                  kg: trip.availableKg,
                  price: formatMoney(trip.pricePerKgCents, trip.currency, locale),
                  status: trip.status,
                }))}
              />
            </div>

            <GpTripsManagerPanel
              locale={locale}
              trips={trips.map((trip) => ({
                ...trip,
                flightDate: trip.flightDate.toISOString(),
              }))}
            />
          </div>

          <div className="grid gap-6">
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {locale === "fr" ? "Clients recents" : "Recent clients"}
                </h2>
                {nextTrip ? (
                  <span className="text-[11px] text-zinc-400">
                    {locale === "fr" ? "Prochain depart" : "Next departure"}: {formatDateOnly(locale, nextTrip.flightDate)}
                  </span>
                ) : null}
                <DashboardListExportButton
                  filename="gp-clients.csv"
                  label={locale === "fr" ? "Exporter les clients" : "Export clients"}
                  disabledLabel={locale === "fr" ? "Aucun client" : "No client"}
                  columns={[
                    { key: "client", label: locale === "fr" ? "Client" : "Client" },
                    { key: "route", label: locale === "fr" ? "Trajet" : "Route" },
                    { key: "status", label: locale === "fr" ? "Statut" : "Status" },
                    { key: "kg", label: "Kg" },
                    { key: "amount", label: locale === "fr" ? "Montant" : "Amount" },
                    { key: "date", label: locale === "fr" ? "Date" : "Date" },
                  ]}
                  rows={recentClientBookings.map((booking) => ({
                    client: booking.customer.name ?? (locale === "fr" ? "Client" : "Customer"),
                    route: `${booking.trip.originCity} -> ${booking.trip.destinationCity}`,
                    status: booking.status,
                    kg: booking.requestedKg,
                    amount: formatMoney(booking.requestedKg * booking.trip.pricePerKgCents, booking.trip.currency, locale),
                    date: formatDateOnly(locale, booking.createdAt),
                  }))}
                />
              </div>
              {recentClientBookings.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">
                  {locale === "fr" ? "Aucun client pour le moment." : "No client yet."}
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {recentClientBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-xs text-zinc-300">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {booking.customer.name ?? (locale === "fr" ? "Client" : "Customer")}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {booking.trip.originCity} {"->"} {booking.trip.destinationCity}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300">
                          {booking.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                        <span>{booking.requestedKg}kg</span>
                        <span>{formatMoney(booking.requestedKg * booking.trip.pricePerKgCents, booking.trip.currency, locale)}</span>
                        <span>{formatDateOnly(locale, booking.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-semibold text-white">
                {locale === "fr" ? "Avis recus" : "Received reviews"}
              </h2>
              <div className="mt-3">
                <DashboardListExportButton
                  filename="gp-reviews.csv"
                  label={locale === "fr" ? "Exporter les avis" : "Export reviews"}
                  disabledLabel={locale === "fr" ? "Aucun avis" : "No review"}
                  columns={[
                    { key: "reviewer", label: locale === "fr" ? "Client" : "Client" },
                    { key: "route", label: locale === "fr" ? "Trajet" : "Route" },
                    { key: "rating", label: locale === "fr" ? "Note" : "Rating" },
                    { key: "comment", label: locale === "fr" ? "Commentaire" : "Comment" },
                    { key: "date", label: locale === "fr" ? "Date" : "Date" },
                  ]}
                  rows={recentReviews.map((review) => ({
                    reviewer: review.reviewer.name ?? (locale === "fr" ? "Client" : "Customer"),
                    route: `${review.trip.originCity} -> ${review.trip.destinationCity}`,
                    rating: `${review.rating}/5`,
                    comment: review.comment ?? "",
                    date: new Date(review.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US"),
                  }))}
                />
              </div>
              {recentReviews.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">
                  {locale === "fr" ? "Aucun avis pour le moment." : "No reviews yet."}
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-xs text-zinc-300">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-amber-200">{review.rating}/5</p>
                        <p className="text-[11px] text-zinc-500">
                          {new Date(review.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {review.reviewer.name ?? (locale === "fr" ? "Client" : "Customer")} - {review.trip.originCity} {"->"} {review.trip.destinationCity}
                      </p>
                      {review.comment ? <p className="mt-2">{review.comment}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {locale === "fr" ? "Lecture rapide" : "Quick read"}
              </h2>
              <p className="mt-1 text-zinc-400">
                {locale === "fr"
                  ? "Un panorama simple de la traction du compte transporteur."
                  : "A simple overview of transporter account momentum."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 px-3 py-1">
                {locale === "fr" ? "Prix moyen ouvert" : "Average open price"}: {averagePrice > 0 ? formatMoney(averagePrice, displayCurrency, locale) : "-"}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1">
                {locale === "fr" ? "Clients actifs" : "Active clients"}: {uniqueClients}
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
