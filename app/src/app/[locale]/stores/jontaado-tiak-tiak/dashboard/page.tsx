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
    path: "/stores/jontaado-tiak-tiak/dashboard",
    title: isFr
      ? "Dashboard TIAK TIAK | Espace coursier prive"
      : "TIAK TIAK dashboard | Private courier space",
    description: isFr
      ? "Pilote tes livraisons, tes gains et ton activite depuis le dashboard prive TIAK TIAK."
      : "Track deliveries, earnings and activity from the private TIAK TIAK dashboard.",
    imagePath: "/stores/tiak.png",
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

function formatRouteLabel(pickupAddress: string, dropoffAddress: string) {
  const pickup = pickupAddress.split(",")[0]?.trim() || pickupAddress;
  const dropoff = dropoffAddress.split(",")[0]?.trim() || dropoffAddress;
  return `${pickup} -> ${dropoff}`;
}

export default async function TiakDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const isFr = locale === "fr";
  const rules = getVerticalRules(Vertical.TIAK_TIAK);
  const canAccess = hasAnyUserRole(session?.user, rules.publishRoles);

  if (!session?.user?.id || !canAccess) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {isFr ? "Acces livreur requis" : "Courier access required"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {isFr
                ? "Ce dashboard est reserve aux coursiers TIAK TIAK."
                : "This dashboard is reserved for TIAK TIAK couriers."}
            </p>
            <Link
              href="/stores/jontaado-tiak-tiak"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {isFr ? "Retour a TIAK TIAK" : "Back to TIAK TIAK"}
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
    courierProfile,
    totalDeliveries,
    activeDeliveries,
    completedDeliveries,
    uniqueClientRows,
    paidPayoutAggregate,
    pendingPayoutAggregate,
    recentDeliveries,
    trendDeliveries,
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
    prisma.tiakCourierProfile.findUnique({
      where: { courierId: session.user.id },
      select: {
        isActive: true,
        cities: true,
        vehicleType: true,
      },
    }),
    prisma.tiakDelivery.count({
      where: { courierId: session.user.id },
    }),
    prisma.tiakDelivery.count({
      where: {
        courierId: session.user.id,
        status: { in: ["ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED"] },
      },
    }),
    prisma.tiakDelivery.count({
      where: {
        courierId: session.user.id,
        status: "COMPLETED",
      },
    }),
    prisma.tiakDelivery.findMany({
      where: { courierId: session.user.id },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
    prisma.tiakPayout.aggregate({
      _sum: { courierPayoutCents: true },
      where: {
        courierId: session.user.id,
        status: "PAID",
      },
    }),
    prisma.tiakPayout.aggregate({
      _sum: { courierPayoutCents: true },
      where: {
        courierId: session.user.id,
        status: { in: ["PENDING", "READY"] },
      },
    }),
    prisma.tiakDelivery.findMany({
      where: {
        courierId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        status: true,
        priceCents: true,
        currency: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    }),
    prisma.tiakDelivery.findMany({
      where: {
        courierId: session.user.id,
        createdAt: { gte: trendStart },
      },
      select: {
        id: true,
        customerId: true,
        createdAt: true,
      },
    }),
    prisma.tiakPayout.findMany({
      where: {
        courierId: session.user.id,
        createdAt: { gte: trendStart },
      },
      select: {
        createdAt: true,
        courierPayoutCents: true,
        currency: true,
      },
    }),
  ]);

  const trendDates = buildTrendPoints(locale, trendStart, trendDays);
  const deliveriesByDay = Object.fromEntries(trendDates.map((point) => [point.key, 0])) as Record<string, number>;
  const clientSetsByDay = Object.fromEntries(
    trendDates.map((point) => [point.key, new Set<string>()])
  ) as Record<string, Set<string>>;
  const payoutByDay = Object.fromEntries(trendDates.map((point) => [point.key, 0])) as Record<string, number>;

  for (const delivery of trendDeliveries) {
    const key = toDayKey(delivery.createdAt);
    if (!(key in deliveriesByDay)) continue;
    deliveriesByDay[key] += 1;
    clientSetsByDay[key]?.add(delivery.customerId);
  }

  for (const payout of trendPayouts) {
    const key = toDayKey(payout.createdAt);
    if (!(key in payoutByDay)) continue;
    payoutByDay[key] += payout.courierPayoutCents;
  }

  const payoutCurrency = trendPayouts[0]?.currency ?? "XOF";
  const uniqueClients = uniqueClientRows.length;
  const totalPaidCents = paidPayoutAggregate._sum.courierPayoutCents ?? 0;
  const pendingPayoutCents = pendingPayoutAggregate._sum.courierPayoutCents ?? 0;

  const metrics = [
    {
      key: "earnings",
      title: isFr ? "Gains" : "Earnings",
      color: "#34d399",
      series: trendDates.map((point) => payoutByDay[point.key] ?? 0),
      isMoney: true,
      moneyLabel: payoutCurrency === "XOF" ? "FCFA" : payoutCurrency,
    },
    {
      key: "deliveries",
      title: isFr ? "Livraisons" : "Deliveries",
      color: "#22d3ee",
      series: trendDates.map((point) => deliveriesByDay[point.key] ?? 0),
    },
    {
      key: "clients",
      title: isFr ? "Clients" : "Clients",
      color: "#f59e0b",
      series: trendDates.map((point) => clientSetsByDay[point.key]?.size ?? 0),
    },
  ];

  const statCards = [
    { label: isFr ? "Livraisons actives" : "Active deliveries", value: activeDeliveries },
    { label: isFr ? "Livraisons terminees" : "Completed deliveries", value: completedDeliveries },
    { label: isFr ? "Clients servis" : "Served clients", value: uniqueClients },
    { label: isFr ? "Gains verses" : "Paid earnings", value: formatMoney(totalPaidCents, payoutCurrency, locale) },
    { label: isFr ? "A payer" : "Pending payout", value: formatMoney(pendingPayoutCents, payoutCurrency, locale) },
    {
      label: isFr ? "Villes couvertes" : "Covered cities",
      value: courierProfile?.cities.length ?? 0,
    },
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
            href="/stores/jontaado-tiak-tiak"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {isFr ? "Voir TIAK TIAK" : "Go to TIAK TIAK"}
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
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-300/15 via-zinc-900 to-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">JONTAADO TIAK TIAK</p>
          <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
            {isFr ? "Dashboard coursier" : "Courier dashboard"}
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            {isFr
              ? `Bon retour ${user?.name ?? ""}. Pilote tes gains, tes clients et tes livraisons jour apres jour.`
              : `Welcome back ${user?.name ?? ""}. Track earnings, clients and deliveries day by day.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              {isFr ? "Total missions" : "Total missions"}: {totalDeliveries}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {isFr ? "Statut profil" : "Profile status"}: {courierProfile?.isActive ? (isFr ? "Actif" : "Active") : isFr ? "Pause" : "Paused"}
            </span>
            {courierProfile?.vehicleType ? (
              <span className="rounded-full border border-white/15 px-3 py-1">
                {isFr ? "Vehicule" : "Vehicle"}: {courierProfile.vehicleType}
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

        <PartnerTrendsPanel
          locale={locale}
          title={isFr ? "Vue jour par jour" : "Day-by-day view"}
          subtitle={
            isFr
              ? "Le bon niveau de lecture pour voir la traction du compte coursier."
              : "The right level of detail to track courier account momentum."
          }
          dates={trendDates}
          metrics={metrics}
          rangeOptions={[7, 30, 90, 365]}
          defaultRange={30}
          exportFilename="tiak-dashboard.csv"
        />

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                {isFr ? "Clients et courses recentes" : "Recent clients and deliveries"}
              </h2>
              <Link
                href="/stores/jontaado-tiak-tiak"
                className="rounded-full border border-emerald-300/40 px-3 py-1 text-[11px] text-emerald-100 transition hover:border-emerald-300/80"
              >
                {isFr ? "Retour a l'espace" : "Back to space"}
              </Link>
              <DashboardListExportButton
                filename="tiak-deliveries.csv"
                label={isFr ? "Exporter les courses" : "Export deliveries"}
                disabledLabel={isFr ? "Aucune course" : "No delivery"}
                columns={[
                  { key: "client", label: isFr ? "Client" : "Client" },
                  { key: "route", label: isFr ? "Trajet" : "Route" },
                  { key: "status", label: isFr ? "Statut" : "Status" },
                  { key: "amount", label: isFr ? "Montant" : "Amount" },
                  { key: "date", label: isFr ? "Date" : "Date" },
                ]}
                rows={recentDeliveries.map((delivery) => ({
                  client: delivery.customer?.name ?? (isFr ? "Client" : "Client"),
                  route: formatRouteLabel(delivery.pickupAddress, delivery.dropoffAddress),
                  status: delivery.status,
                  amount: delivery.priceCents ? formatMoney(delivery.priceCents, delivery.currency, locale) : "-",
                  date: formatDate(locale, delivery.createdAt),
                }))}
              />
            </div>

            {recentDeliveries.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {isFr ? "Aucune livraison attribuee pour le moment." : "No assigned delivery yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {recentDeliveries.map((delivery) => (
                  <div key={delivery.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {delivery.customer?.name ?? (isFr ? "Client" : "Client")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {formatRouteLabel(delivery.pickupAddress, delivery.dropoffAddress)}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300">
                        {delivery.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                      <span>
                        {delivery.priceCents ? formatMoney(delivery.priceCents, delivery.currency, locale) : "-"}
                      </span>
                      <span>{formatDate(locale, delivery.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">
              {isFr ? "Etat coursier" : "Courier snapshot"}
            </h2>
            <div className="mt-3">
              <DashboardListExportButton
                filename="tiak-courier-snapshot.csv"
                label={isFr ? "Exporter l'etat" : "Export snapshot"}
                columns={[
                  { key: "metric", label: isFr ? "Indicateur" : "Metric" },
                  { key: "value", label: isFr ? "Valeur" : "Value" },
                ]}
                rows={[
                  {
                    metric: isFr ? "Disponibilite" : "Availability",
                    value: courierProfile?.isActive ? (isFr ? "Actif" : "Active") : isFr ? "Pause" : "Paused",
                  },
                  {
                    metric: isFr ? "Zones declarees" : "Declared coverage",
                    value: courierProfile?.cities.length ? courierProfile.cities.join(", ") : isFr ? "Aucune" : "None",
                  },
                  {
                    metric: isFr ? "Total verse" : "Total paid",
                    value: formatMoney(totalPaidCents, payoutCurrency, locale),
                  },
                  {
                    metric: isFr ? "En attente" : "Pending",
                    value: formatMoney(pendingPayoutCents, payoutCurrency, locale),
                  },
                ]}
              />
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <p className="text-sm font-semibold text-white">{isFr ? "Disponibilite" : "Availability"}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {courierProfile?.isActive
                    ? isFr
                      ? "Le profil est visible pour de nouvelles courses."
                      : "The profile is visible for new assignments."
                    : isFr
                      ? "Le profil est actuellement en pause."
                      : "The profile is currently paused."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <p className="text-sm font-semibold text-white">{isFr ? "Zones declarees" : "Declared coverage"}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {courierProfile?.cities.length
                    ? courierProfile.cities.join(", ")
                    : isFr
                      ? "Aucune ville renseignee pour l'instant."
                      : "No city configured yet."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <p className="text-sm font-semibold text-white">{isFr ? "Paiements" : "Payouts"}</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {isFr
                    ? `Total verse: ${formatMoney(totalPaidCents, payoutCurrency, locale)}`
                    : `Total paid: ${formatMoney(totalPaidCents, payoutCurrency, locale)}`}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {isFr
                    ? `En attente: ${formatMoney(pendingPayoutCents, payoutCurrency, locale)}`
                    : `Pending: ${formatMoney(pendingPayoutCents, payoutCurrency, locale)}`}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
