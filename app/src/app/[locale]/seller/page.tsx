import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import SellerTrendsPanel from "@/components/seller/SellerTrendsPanel";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SellerPageProps = {
  searchParams?: Promise<{ range?: string; paid?: string }>;
};

export default async function SellerPage({ searchParams }: SellerPageProps) {
  const session = await getServerSession(authOptions);
  const t = await getTranslations("Seller");
  const tSpace = await getTranslations("SellerSpace");
  const locale = await getLocale();

  const role = session?.user?.role ?? "CUSTOMER";
  const canViewShop = ["SELLER", "ADMIN"].includes(role);
  const canViewPresta = ["PROVIDER", "ADMIN"].includes(role);
  const canViewGp = ["TRANSPORTER", "GP_CARRIER", "TRAVELER", "ADMIN"].includes(role);
  const canViewTiak = ["COURIER", "ADMIN"].includes(role);
  const canAccessPartnerDashboard =
    canViewShop || canViewPresta || canViewGp || canViewTiak;

  if (!session || !canAccessPartnerDashboard) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">{t("guard.title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("guard.subtitle")}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {t("guard.cta")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!canViewShop) {
    const verticalCards = [
      canViewPresta
        ? {
            title: "PRESTA block",
            subtitle: locale === "fr" ? "Stats bientot disponibles" : "Stats coming soon",
            caption: locale === "fr" ? "Acces a venir" : "Access coming soon",
          }
        : null,
      canViewGp
        ? {
            title: "GP block",
            subtitle: locale === "fr" ? "Stats bientot disponibles" : "Stats coming soon",
            caption: locale === "fr" ? "Acces a venir" : "Access coming soon",
          }
        : null,
      canViewTiak
        ? {
            title: "TIAK block",
            subtitle: locale === "fr" ? "Stats bientot disponibles" : "Stats coming soon",
            caption: locale === "fr" ? "Acces a venir" : "Access coming soon",
          }
        : null,
    ].filter((value): value is { title: string; subtitle: string; caption: string } => Boolean(value));

    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
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
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24">
          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {locale === "fr" ? "Dashboard plateforme" : "Platform dashboard"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {locale === "fr"
                ? "Les blocs metiers apparaissent selon ton role."
                : "Vertical blocks appear based on your role."}
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {verticalCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6"
              >
                <h2 className="text-lg font-semibold text-white">{card.title} (coming next)</h2>
                <p className="mt-2 text-sm text-zinc-300">{card.subtitle}</p>
                <p className="mt-1 text-xs text-zinc-500">{card.caption}</p>
              </article>
            ))}
          </section>
        </main>

        <Footer />
      </div>
    );
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!seller) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">{t("guard.title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("guard.subtitle")}</p>
            <Link
              href="/profile"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {t("guard.cta")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const rangeOptions = [30, 90, 365];
  const resolvedSearch = searchParams ? await searchParams : {};
  const rangeParam = Number(resolvedSearch?.range ?? 30);
  const rangeDays = rangeOptions.includes(rangeParam) ? rangeParam : 30;
  const paidOnly = resolvedSearch?.paid !== "0";
  const orderScope = paidOnly ? { paymentStatus: "PAID" as const } : {};
  const rangeLabels: Record<number, string> = {
    30: t("filters.month"),
    90: t("filters.ninetyDays"),
    365: t("filters.year"),
  };
  const payoutDelayDays = 7;
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1));
  const trendDays = rangeDays;
  const trendStart = new Date(rangeStart);

  const [
    totalProducts,
    activeProducts,
    pendingOrders,
    revenueTotal,
    revenueRange,
    avgOrder,
    recentOrders,
    topItems,
    topClientStats,
    topClientOrderStats,
    lowStock,
    pendingPayouts,
    pendingPayoutList,
    trendOrders,
  ] = await Promise.all([
    prisma.product.count({ where: { sellerId: seller.id } }),
    prisma.product.count({ where: { sellerId: seller.id, isActive: true } }),
    prisma.order.count({ where: { sellerId: seller.id, status: "PENDING" } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { sellerId: seller.id, ...orderScope },
    }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { sellerId: seller.id, createdAt: { gte: rangeStart }, ...orderScope },
    }),
    prisma.order.aggregate({
      _avg: { totalCents: true },
      where: { sellerId: seller.id, ...orderScope },
    }),
    prisma.order.findMany({
      where: { sellerId: seller.id, createdAt: { gte: rangeStart }, ...orderScope },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: { select: { quantity: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: {
        order: { sellerId: seller.id, createdAt: { gte: rangeStart }, ...orderScope },
      },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["userId"],
      _sum: { totalCents: true },
      _count: { _all: true },
      where: { sellerId: seller.id, createdAt: { gte: rangeStart }, ...orderScope },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["userId"],
      _sum: { totalCents: true },
      _count: { _all: true },
      where: { sellerId: seller.id, createdAt: { gte: rangeStart }, ...orderScope },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
    prisma.product.findMany({
      where: {
        sellerId: seller.id,
        type: "LOCAL",
        isActive: true,
        stockQuantity: { lte: 5 },
      },
      orderBy: { stockQuantity: "asc" },
      take: 5,
      select: { id: true, title: true, slug: true, stockQuantity: true },
    }),
    prisma.payout.aggregate({
      _sum: { amountCents: true },
      _count: { _all: true },
      where: { sellerId: seller.id, status: "PENDING" },
    }),
    prisma.payout.findMany({
      where: { sellerId: seller.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { id: true, amountCents: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { sellerId: seller.id, createdAt: { gte: trendStart }, ...orderScope },
      select: {
        createdAt: true,
        paymentStatus: true,
        totalCents: true,
        items: { select: { quantity: true } },
      },
    }),
  ]);

  const topProductIds = topItems.map((item) => item.productId);
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          priceCents: true,
          currency: true,
          images: { select: { url: true }, take: 1 },
        },
      })
    : [];
  const topProductMap = new Map(topProducts.map((product) => [product.id, product]));
  const topProductMax = Math.max(
    ...topItems.map((item) => item._sum.quantity ?? 0),
    1
  );
  const topClientIds = Array.from(
    new Set([
      ...topClientStats.map((stat) => stat.userId),
      ...topClientOrderStats.map((stat) => stat.userId),
    ])
  );
  const topClientsData = topClientIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topClientIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const topClientMap = new Map(topClientsData.map((client) => [client.id, client]));
  const topClientsByRevenue = topClientStats.map((stat) => {
    const client = topClientMap.get(stat.userId);
    return {
      id: stat.userId,
      name: client?.name ?? client?.email ?? t("topClients.unknown"),
      email: client?.email ?? "",
      totalCents: stat._sum.totalCents ?? 0,
      orders: stat._count._all ?? 0,
    };
  });
  const topClientsByOrders = topClientOrderStats.map((stat) => {
    const client = topClientMap.get(stat.userId);
    return {
      id: stat.userId,
      name: client?.name ?? client?.email ?? t("topClients.unknown"),
      email: client?.email ?? "",
      totalCents: stat._sum.totalCents ?? 0,
      orders: stat._count._all ?? 0,
    };
  });
  const topClientMax = Math.max(
    ...topClientsByRevenue.map((client) => client.totalCents),
    1
  );
  const topClientOrdersMax = Math.max(
    ...topClientsByOrders.map((client) => client.orders),
    1
  );
  const pendingPayoutSchedule = pendingPayoutList.map((payout) => {
    const eta = new Date(payout.createdAt);
    eta.setDate(eta.getDate() + payoutDelayDays);
    return {
      id: payout.id,
      amountCents: payout.amountCents,
      eta,
    };
  });
  const nextPayoutDate = pendingPayoutSchedule[0]?.eta ?? null;

  const dayKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const trendDates = Array.from({ length: trendDays }).map((_, index) => {
    const d = new Date(trendStart);
    d.setDate(trendStart.getDate() + index);
    return {
      key: dayKey(d),
      label: d.toLocaleDateString(locale, { month: "short", day: "numeric" }),
      day: d.getDate(),
      month: d.toLocaleDateString(locale, { month: "short" }),
      showMonth: d.getDate() === 1 || index === 0,
    };
  });

  const revenueByDay = Object.fromEntries(
    trendDates.map((d) => [d.key, 0])
  ) as Record<string, number>;
  const ordersByDay = Object.fromEntries(
    trendDates.map((d) => [d.key, 0])
  ) as Record<string, number>;
  const itemsByDay = Object.fromEntries(
    trendDates.map((d) => [d.key, 0])
  ) as Record<string, number>;

  for (const order of trendOrders) {
    const key = dayKey(order.createdAt);
    if (key in ordersByDay) {
      ordersByDay[key] += 1;
      if (!paidOnly || order.paymentStatus === "PAID") {
        revenueByDay[key] += order.totalCents;
      }
      itemsByDay[key] += order.items.reduce((sum, item) => sum + item.quantity, 0);
    }
  }

  const revenueSeries = trendDates.map((d) => revenueByDay[d.key] ?? 0);
  const ordersSeries = trendDates.map((d) => ordersByDay[d.key] ?? 0);
  const itemsSeries = trendDates.map((d) => itemsByDay[d.key] ?? 0);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
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
        {session.user.role === "ADMIN" ? (
          <Link
            href="/admin"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("nav.admin")}
          </Link>
        ) : null}
        <Link
          href="/seller/products"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.products")}
        </Link>
        <Link
          href="/seller/orders"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.orders")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-300/15 via-zinc-900 to-zinc-900 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
            {t("dashboard.title")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {seller.displayName}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">
            {t("dashboard.subtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              {t(`dashboard.status.${seller.status.toLowerCase()}`)}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {t("dashboard.rating")} {seller.rating.toFixed(1)}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {t("dashboard.products")} {totalProducts}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold">
            <Link
              href="/seller/products/new"
              className="rounded-full bg-emerald-400 px-5 py-2 text-zinc-950"
            >
              {t("actions.newProduct")}
            </Link>
            <Link
              href="/seller/orders"
              className="rounded-full border border-white/20 px-5 py-2 text-white"
            >
              {t("actions.manageOrders")}
            </Link>
            <Link
              href="/seller/products"
              className="rounded-full border border-white/20 px-5 py-2 text-white"
            >
              {t("actions.manageProducts")}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-zinc-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                {t("filters.range")}
              </span>
              {rangeOptions.map((value) => (
                <Link
                  key={value}
                  href={`/seller?range=${value}&paid=${paidOnly ? 1 : 0}`}
                  className={`rounded-full px-3 py-1 text-[11px] transition ${
                    value === rangeDays
                      ? "bg-emerald-400 text-zinc-950"
                      : "border border-white/15 text-zinc-300 hover:border-white/40"
                  }`}
                >
                  {rangeLabels[value] ?? t("filters.days", { days: value })}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                {t("filters.scope")}
              </span>
              <Link
                href={`/seller?range=${rangeDays}&paid=1`}
                className={`rounded-full px-3 py-1 text-[11px] transition ${
                  paidOnly
                    ? "bg-sky-400 text-zinc-950"
                    : "border border-white/15 text-zinc-300 hover:border-white/40"
                }`}
              >
                {t("filters.paid")}
              </Link>
              <Link
                href={`/seller?range=${rangeDays}&paid=0`}
                className={`rounded-full px-3 py-1 text-[11px] transition ${
                  !paidOnly
                    ? "bg-sky-400 text-zinc-950"
                    : "border border-white/15 text-zinc-300 hover:border-white/40"
                }`}
              >
                {t("filters.all")}
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          {[
            {
              label: t("kpis.revenueTotal"),
              value: formatMoney(revenueTotal._sum.totalCents ?? 0, "XOF", locale),
            },
            {
              label: t("kpis.revenueRange", { days: rangeDays }),
              value: formatMoney(revenueRange._sum.totalCents ?? 0, "XOF", locale),
            },
            {
              label: t("kpis.avgOrder"),
              value: formatMoney(Math.round(avgOrder._avg.totalCents ?? 0), "XOF", locale),
            },
            {
              label: t("kpis.ordersPending"),
              value: pendingOrders,
            },
            {
              label: t("kpis.activeProducts"),
              value: activeProducts,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5"
            >
              <p className="text-xs text-zinc-400">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <SellerTrendsPanel
          dates={trendDates}
          revenueSeries={revenueSeries}
          ordersSeries={ordersSeries}
          itemsSeries={itemsSeries}
          rangeOptions={rangeOptions}
          defaultRange={rangeDays}
        />

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t("sections.topProducts")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("sections.topProductsDesc")}</p>
              </div>
              <Link
                href="/seller/products"
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
              >
                {t("actions.manageProducts")}
              </Link>
            </div>
            {topItems.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">{t("sections.empty")}</p>
            )}
            {topItems.length > 0 && (
              <div className="mt-5 grid gap-3">
                {topItems.map((item) => {
                  const product = topProductMap.get(item.productId);
                  const units = item._sum.quantity ?? 0;
                  const width = Math.round((units / topProductMax) * 100);
                  return (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {product?.title ?? t("topProducts.unknown")}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {formatMoney(product?.priceCents ?? 0, product?.currency ?? "XOF", locale)}
                          </p>
                        </div>
                        <div className="text-emerald-200">
                          {t("topProducts.units", { count: units })}
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t("sections.topClients")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("sections.topClientsDesc")}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                {t("kpis.revenueRange", { days: rangeDays })}
              </span>
            </div>
            {topClientsByRevenue.length === 0 && topClientsByOrders.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">{t("topClients.empty")}</p>
            )}
            {(topClientsByRevenue.length > 0 || topClientsByOrders.length > 0) && (
              <div className="mt-5 grid gap-6 text-xs text-zinc-300">
                {topClientsByRevenue.length > 0 && (
                  <div className="grid gap-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      {t("topClients.byRevenue")}
                    </p>
                    {topClientsByRevenue.map((client) => {
                      const width = Math.round((client.totalCents / topClientMax) * 100);
                      return (
                        <div
                          key={client.id}
                          className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{client.name}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {client.email || t("topClients.noEmail")}
                              </p>
                            </div>
                            <div className="text-sky-200">
                              {formatMoney(client.totalCents, "XOF", locale)}
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] text-zinc-400">
                            {t("topClients.orders", { count: client.orders })}
                          </div>
                          <div className="mt-3 h-2 w-full rounded-full bg-zinc-800">
                            <div
                              className="h-2 rounded-full bg-sky-400"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {topClientsByOrders.length > 0 && (
                  <div className="grid gap-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      {t("topClients.byOrders")}
                    </p>
                    {topClientsByOrders.map((client) => {
                      const width = Math.round((client.orders / topClientOrdersMax) * 100);
                      return (
                        <div
                          key={client.id}
                          className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{client.name}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {client.email || t("topClients.noEmail")}
                              </p>
                            </div>
                            <div className="text-amber-200">
                              {t("topClients.orders", { count: client.orders })}
                            </div>
                          </div>
                          <div className="mt-3 h-2 w-full rounded-full bg-zinc-800">
                            <div
                              className="h-2 rounded-full bg-amber-400"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t("sections.recentOrders")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("sections.recentOrdersDesc")}</p>
              </div>
              <Link
                href="/seller/orders"
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
              >
                {t("actions.manageOrders")}
              </Link>
            </div>
            {recentOrders.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">{t("recentOrders.empty")}</p>
            )}
            {recentOrders.length > 0 && (
              <div className="mt-5 grid gap-3">
                {recentOrders.map((order) => {
                  const customer =
                    order.buyerName ??
                    order.buyerEmail ??
                    order.user?.name ??
                    order.user?.email ??
                    t("recentOrders.unknown");
                  return (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-xs text-zinc-300"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {t("recentOrders.order")} #{order.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">{customer}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {new Date(order.createdAt).toLocaleString(locale)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase">
                          {tSpace(`orders.status.${order.status.toLowerCase()}`)}
                        </span>
                        <p className="mt-2 text-sm text-emerald-200">
                          {formatMoney(order.totalCents, order.currency, locale)}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {t("recentOrders.items", { count: order.items.length })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t("sections.stock")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("sections.stockDesc")}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                {t("kpis.activeProducts")} {activeProducts}
              </span>
            </div>
            {lowStock.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">{t("stock.empty")}</p>
            )}
            {lowStock.length > 0 && (
              <div className="mt-5 grid gap-3 text-xs text-zinc-300">
                {lowStock.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{product.title}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{product.slug}</p>
                    </div>
                    <span className="text-amber-200">
                      {t("stock.units", { count: product.stockQuantity ?? 0 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>


        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-400/10 p-8">
          <h2 className="text-xl font-semibold">{t("payouts.title")}</h2>
          <p className="mt-2 text-sm text-zinc-300">{t("payouts.desc")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <p className="text-xs text-zinc-400">{t("payouts.pending")}</p>
              <p className="mt-2 text-lg font-semibold text-emerald-200">
                {formatMoney(pendingPayouts._sum.amountCents ?? 0, "XOF", locale)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {t("payouts.pendingCount", { count: pendingPayouts._count._all ?? 0 })}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <p className="text-xs text-zinc-400">{t("payouts.rangeLabel", { days: rangeDays })}</p>
              <p className="mt-2 text-lg font-semibold text-sky-200">
                {formatMoney(revenueRange._sum.totalCents ?? 0, "XOF", locale)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{t("payouts.rangeHint")}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-xs text-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-400">{t("payouts.nextRelease")}</p>
              <span className="text-[11px] text-zinc-500">
                {t("payouts.delayNote", { days: payoutDelayDays })}
              </span>
            </div>
            {pendingPayoutSchedule.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">{t("payouts.none")}</p>
            ) : (
              <div className="mt-3 grid gap-2">
                <p className="text-sm font-semibold text-emerald-200">
                  {nextPayoutDate ? nextPayoutDate.toLocaleDateString(locale) : "-"}
                </p>
                <div className="grid gap-2">
                  {pendingPayoutSchedule.map((payout) => (
                    <div
                      key={payout.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-[11px]"
                    >
                      <span>
                        {t("payouts.eta", {
                          date: payout.eta.toLocaleDateString(locale),
                        })}
                      </span>
                      <span className="text-emerald-200">
                        {formatMoney(payout.amountCents, "XOF", locale)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">
              {t("payouts.badge1")}
            </span>
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">
              {t("payouts.badge2")}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
              {t("kpis.activeProducts")} {activeProducts} - {t("kpis.revenueRange", { days: rangeDays })}
            </span>
          </div>
        </section>

        {(canViewPresta || canViewGp || canViewTiak) && (
          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h2 className="text-xl font-semibold text-white">
              {locale === "fr" ? "Blocs autres verticales" : "Other vertical blocks"}
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              {locale === "fr"
                ? "Le bloc SHOP reste actif. Les autres verticales arrivent ici."
                : "SHOP stays active. Other verticals will appear here."}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {canViewPresta && (
                <article className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                  <h3 className="text-base font-semibold text-white">PRESTA block (coming next)</h3>
                  <p className="mt-2 text-sm text-zinc-300">
                    {locale === "fr" ? "Stats bientot disponibles" : "Stats coming soon"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {locale === "fr" ? "Acces a venir" : "Access coming soon"}
                  </p>
                </article>
              )}
              {canViewGp && (
                <article className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                  <h3 className="text-base font-semibold text-white">GP block (coming next)</h3>
                  <p className="mt-2 text-sm text-zinc-300">
                    {locale === "fr" ? "Stats bientot disponibles" : "Stats coming soon"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {locale === "fr" ? "Acces a venir" : "Access coming soon"}
                  </p>
                </article>
              )}
              {canViewTiak && (
                <article className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                  <h3 className="text-base font-semibold text-white">TIAK block (coming next)</h3>
                  <p className="mt-2 text-sm text-zinc-300">
                    {locale === "fr" ? "Stats bientot disponibles" : "Stats coming soon"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {locale === "fr" ? "Acces a venir" : "Access coming soon"}
                  </p>
                </article>
              )}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
