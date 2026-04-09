import Image from "next/image";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import DashboardListExportButton from "@/components/dashboard/DashboardListExportButton";
import PartnerTrendsPanel from "@/components/dashboard/PartnerTrendsPanel";
import { authOptions } from "@/lib/auth";
import { buildTrendPoints, toDayKey } from "@/lib/dashboard/trends";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
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
    path: "/stores/jontaado-presta/dashboard",
    title: isFr
      ? "Dashboard PRESTA | Espace prestataire prive"
      : "PRESTA dashboard | Private provider space",
    description: isFr
      ? "Suis tes gains, tes reservations et tes clients depuis le dashboard prive PRESTA."
      : "Track earnings, bookings and clients from the private PRESTA dashboard.",
    imagePath: "/stores/presta.png",
    noIndex: true,
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

export default async function PrestaDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const isFr = locale === "fr";
  const rules = getVerticalRules(Vertical.PRESTA);
  const canAccess = hasAnyUserRole(session?.user, rules.publishRoles);

  if (!session?.user?.id || !canAccess) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {isFr ? "Acces prestataire requis" : "Provider access required"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {isFr
                ? "Ce dashboard est reserve aux prestataires PRESTA."
                : "This dashboard is reserved for PRESTA providers."}
            </p>
            <Link
              href="/stores/jontaado-presta"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {isFr ? "Retour a PRESTA" : "Back to PRESTA"}
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
    totalServices,
    activeServices,
    activeBookings,
    completedBookings,
    uniqueClientRows,
    paidPayoutAggregate,
    pendingPayoutAggregate,
    proposalsPending,
    reviewAggregate,
    recentBookings,
    topServices,
    trendBookings,
    trendPayouts,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
      },
    }),
    prisma.prestaService.count({
      where: { providerId: session.user.id },
    }),
    prisma.prestaService.count({
      where: { providerId: session.user.id, isActive: true },
    }),
    prisma.prestaBooking.count({
      where: {
        providerId: session.user.id,
        status: { in: ["PENDING", "CONFIRMED", "PAID"] },
      },
    }),
    prisma.prestaBooking.count({
      where: {
        providerId: session.user.id,
        status: "COMPLETED",
      },
    }),
    prisma.prestaBooking.findMany({
      where: { providerId: session.user.id },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
    prisma.prestaPayout.aggregate({
      _sum: { providerPayoutCents: true },
      where: {
        providerId: session.user.id,
        status: "PAID",
      },
    }),
    prisma.prestaPayout.aggregate({
      _sum: { providerPayoutCents: true },
      where: {
        providerId: session.user.id,
        status: { in: ["PENDING", "READY"] },
      },
    }),
    prisma.prestaProposal.count({
      where: {
        providerId: session.user.id,
        status: "PENDING",
      },
    }),
    prisma.review.aggregate({
      _avg: { rating: true },
      _count: { _all: true },
      where: { targetUserId: session.user.id },
    }),
    prisma.prestaBooking.findMany({
      where: { providerId: session.user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        service: {
          select: {
            title: true,
            city: true,
          },
        },
      },
    }),
    prisma.prestaService.findMany({
      where: { providerId: session.user.id },
      orderBy: [{ bookings: { _count: "desc" } }, { updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        title: true,
        city: true,
        basePriceCents: true,
        currency: true,
        isActive: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    }),
    prisma.prestaBooking.findMany({
      where: {
        providerId: session.user.id,
        createdAt: { gte: trendStart },
      },
      select: {
        id: true,
        customerId: true,
        createdAt: true,
      },
    }),
    prisma.prestaPayout.findMany({
      where: {
        providerId: session.user.id,
        createdAt: { gte: trendStart },
      },
      select: {
        createdAt: true,
        providerPayoutCents: true,
        currency: true,
      },
    }),
  ]);

  const trendDates = buildTrendPoints(locale, trendStart, trendDays);
  const bookingsByDay = Object.fromEntries(trendDates.map((point) => [point.key, 0])) as Record<string, number>;
  const clientSetsByDay = Object.fromEntries(
    trendDates.map((point) => [point.key, new Set<string>()])
  ) as Record<string, Set<string>>;
  const payoutByDay = Object.fromEntries(trendDates.map((point) => [point.key, 0])) as Record<string, number>;

  for (const booking of trendBookings) {
    const key = toDayKey(booking.createdAt);
    if (!(key in bookingsByDay)) continue;
    bookingsByDay[key] += 1;
    clientSetsByDay[key]?.add(booking.customerId);
  }

  for (const payout of trendPayouts) {
    const key = toDayKey(payout.createdAt);
    if (!(key in payoutByDay)) continue;
    payoutByDay[key] += payout.providerPayoutCents;
  }

  const payoutCurrency = trendPayouts[0]?.currency ?? "XOF";
  const metrics = [
    {
      key: "earnings",
      title: isFr ? "Gains verses" : "Paid earnings",
      color: "#34d399",
      series: trendDates.map((point) => payoutByDay[point.key] ?? 0),
      isMoney: true,
      moneyLabel: payoutCurrency === "XOF" ? "FCFA" : payoutCurrency,
    },
    {
      key: "bookings",
      title: isFr ? "Reservations" : "Bookings",
      color: "#60a5fa",
      series: trendDates.map((point) => bookingsByDay[point.key] ?? 0),
    },
    {
      key: "clients",
      title: isFr ? "Clients" : "Clients",
      color: "#f59e0b",
      series: trendDates.map((point) => clientSetsByDay[point.key]?.size ?? 0),
    },
  ];

  const totalPaidCents = paidPayoutAggregate._sum.providerPayoutCents ?? 0;
  const pendingPayoutCents = pendingPayoutAggregate._sum.providerPayoutCents ?? 0;
  const uniqueClients = uniqueClientRows.length;
  const averageRating = reviewAggregate._avg.rating ?? 0;
  const reviewCount = reviewAggregate._count._all;

  const statCards = [
    { label: isFr ? "Services actifs" : "Active services", value: activeServices },
    { label: isFr ? "Reservations en cours" : "Active bookings", value: activeBookings },
    { label: isFr ? "Missions terminees" : "Completed jobs", value: completedBookings },
    { label: isFr ? "Clients uniques" : "Unique clients", value: uniqueClients },
    { label: isFr ? "Gains verses" : "Paid earnings", value: formatMoney(totalPaidCents, payoutCurrency, locale) },
    { label: isFr ? "A payer" : "Pending payout", value: formatMoney(pendingPayoutCents, payoutCurrency, locale) },
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
            href="/stores/jontaado-presta"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {isFr ? "Voir PRESTA" : "Go to PRESTA"}
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {isFr ? "Profil" : "Profile"}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-300/15 via-zinc-900 to-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-200">JONTAADO PRESTA</p>
          <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
            {isFr ? "Dashboard prestataire" : "Provider dashboard"}
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            {isFr
              ? `Bon retour ${user?.name ?? ""}. Suis tes gains, tes clients et ton rythme de reservation jour par jour.`
              : `Welcome back ${user?.name ?? ""}. Track earnings, clients and booking rhythm day by day.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              {isFr ? "Catalogue" : "Catalog"}: {totalServices}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {isFr ? "Propositions en attente" : "Pending proposals"}: {proposalsPending}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {isFr ? "Avis" : "Reviews"}: {reviewCount} - {averageRating.toFixed(1)}/5
            </span>
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

        <PartnerTrendsPanel
          locale={locale}
          title={isFr ? "Vue jour par jour" : "Day-by-day view"}
          subtitle={
            isFr
              ? "Une lecture simple de tes gains, reservations et nouveaux clients."
              : "A simple read of earnings, bookings and new clients."
          }
          dates={trendDates}
          metrics={metrics}
          rangeOptions={[7, 30, 90, 365]}
          defaultRange={30}
          exportFilename="presta-dashboard.csv"
        />

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                {isFr ? "Clients et reservations recentes" : "Recent clients and bookings"}
              </h2>
              <Link
                href="/stores/jontaado-presta"
                className="rounded-full border border-amber-300/40 px-3 py-1 text-[11px] text-amber-100 transition hover:border-amber-300/80"
              >
                {isFr ? "Retour a l'espace" : "Back to space"}
              </Link>
              <DashboardListExportButton
                filename="presta-bookings.csv"
                label={isFr ? "Exporter les reservations" : "Export bookings"}
                disabledLabel={isFr ? "Aucune reservation" : "No bookings"}
                columns={[
                  { key: "client", label: isFr ? "Client" : "Client" },
                  { key: "service", label: isFr ? "Service" : "Service" },
                  { key: "city", label: isFr ? "Ville" : "City" },
                  { key: "status", label: isFr ? "Statut" : "Status" },
                  { key: "amount", label: isFr ? "Montant" : "Amount" },
                  { key: "date", label: isFr ? "Date" : "Date" },
                ]}
                rows={recentBookings.map((booking) => ({
                  client: booking.customer.name ?? (isFr ? "Client" : "Client"),
                  service: booking.service.title,
                  city: booking.service.city ?? "",
                  status: booking.status,
                  amount: formatMoney(booking.totalCents, booking.currency, locale),
                  date: formatDate(locale, booking.createdAt),
                }))}
              />
            </div>

            {recentBookings.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {isFr ? "Aucune reservation pour le moment." : "No bookings yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {booking.customer.name ?? (isFr ? "Client" : "Client")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {booking.service.title}
                          {booking.service.city ? ` - ${booking.service.city}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300">
                        {booking.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                      <span>{formatMoney(booking.totalCents, booking.currency, locale)}</span>
                      <span>{formatDate(locale, booking.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">
              {isFr ? "Services qui performent" : "Top performing services"}
            </h2>
            <div className="mt-3">
              <DashboardListExportButton
                filename="presta-services.csv"
                label={isFr ? "Exporter les services" : "Export services"}
                disabledLabel={isFr ? "Aucun service" : "No service"}
                columns={[
                  { key: "title", label: isFr ? "Service" : "Service" },
                  { key: "city", label: isFr ? "Ville" : "City" },
                  { key: "price", label: isFr ? "Prix" : "Price" },
                  { key: "bookings", label: isFr ? "Reservations" : "Bookings" },
                  { key: "status", label: isFr ? "Statut" : "Status" },
                ]}
                rows={topServices.map((service) => ({
                  title: service.title,
                  city: service.city ?? "",
                  price: formatMoney(service.basePriceCents, service.currency, locale),
                  bookings: service._count.bookings,
                  status: service.isActive ? (isFr ? "Actif" : "Active") : isFr ? "Pause" : "Paused",
                }))}
              />
            </div>
            {topServices.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {isFr ? "Publie un premier service pour voir les tendances." : "Publish your first service to unlock trends."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {topServices.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{service.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {service.city ?? (isFr ? "Ville non renseignee" : "City not set")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                          service.isActive ? "bg-emerald-400/20 text-emerald-200" : "bg-zinc-700/40 text-zinc-300"
                        }`}
                      >
                        {service.isActive ? (isFr ? "Actif" : "Active") : isFr ? "Pause" : "Paused"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                      <span>{formatMoney(service.basePriceCents, service.currency, locale)}</span>
                      <span>
                        {isFr ? "Reservations" : "Bookings"}: {service._count.bookings}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
