import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Footer from "@/components/layout/Footer";
import AdminTrendsPanel from "@/components/admin/AdminTrendsPanel";
import AdminOpsHub from "@/components/admin/AdminOpsHub";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();
  const t = await getTranslations("Admin");

  if (!session || session.user.role !== "ADMIN") {
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

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const last30Days = new Date(now);
  last30Days.setDate(last30Days.getDate() - 30);
  const last7Days = new Date(now);
  last7Days.setDate(last7Days.getDate() - 7);
  const trendDays = 30;
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (trendDays - 1));

  const [
    usersCount,
    sellersCount,
    storesCount,
    categoriesCount,
    pendingKycCount,
    pendingOrdersCount,
    inactiveProductsCount,
    failedPaymentsCount,
    ordersTodayCount,
    revenueTotal,
    revenueMonth,
    avgOrder,
    recentOrders,
    recentUsers,
    topItems,
    topSellerStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.sellerProfile.count(),
    prisma.store.count(),
    prisma.category.count(),
    prisma.kycSubmission.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { isActive: false } }),
    prisma.order.count({ where: { paymentStatus: "FAILED" } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { paymentStatus: "PAID", createdAt: { gte: last30Days } },
    }),
    prisma.order.aggregate({
      _avg: { totalCents: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { totalCents: true, paymentStatus: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: { order: { paymentStatus: "PAID" } },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["sellerId"],
      _sum: { totalCents: true },
      _count: { _all: true },
      where: { paymentStatus: "PAID", sellerId: { not: null } },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 5,
    }),
  ]);

  const topProductIds = topItems.map((item) => item.productId);
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, title: true, slug: true, seller: { select: { displayName: true } } },
      })
    : [];
  const topProductMap = new Map(topProducts.map((product) => [product.id, product]));

  const topSellerIds = topSellerStats
    .map((stat) => stat.sellerId)
    .filter((id): id is string => Boolean(id));
  const sellerProfiles = topSellerIds.length
    ? await prisma.sellerProfile.findMany({
        where: { id: { in: topSellerIds } },
        select: {
          id: true,
          displayName: true,
          slug: true,
          user: { select: { name: true, email: true } },
        },
      })
    : [];
  const sellerMap = new Map(sellerProfiles.map((seller) => [seller.id, seller]));
  const topSellers = topSellerStats.map((stat) => {
    const seller = stat.sellerId ? sellerMap.get(stat.sellerId) : undefined;
    return {
      id: stat.sellerId ?? "",
      name: seller?.displayName ?? seller?.user?.name ?? t("topSellers.unknownSeller"),
      slug: seller?.slug ?? null,
      revenueCents: stat._sum.totalCents ?? 0,
      orders: stat._count._all ?? 0,
    };
  });

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
  const usersByDay = Object.fromEntries(
    trendDates.map((d) => [d.key, 0])
  ) as Record<string, number>;

  for (const order of recentOrders) {
    const key = dayKey(order.createdAt);
    if (key in ordersByDay) {
      ordersByDay[key] += 1;
      if (order.paymentStatus === "PAID") {
        revenueByDay[key] += order.totalCents;
      }
    }
  }

  for (const user of recentUsers) {
    const key = dayKey(user.createdAt);
    if (key in usersByDay) {
      usersByDay[key] += 1;
    }
  }

  const revenueSeries = trendDates.map((d) => revenueByDay[d.key] ?? 0);
  const ordersSeries = trendDates.map((d) => ordersByDay[d.key] ?? 0);
  const usersSeries = trendDates.map((d) => usersByDay[d.key] ?? 0);
  const topProductMax = Math.max(
    ...topItems.map((item) => item._sum.quantity ?? 0),
    1
  );
  const topSellerMax = Math.max(
    ...topSellers.map((seller) => seller.revenueCents),
    1
  );

  const [
    prestaPayoutReadyCount,
    tiakPayoutReadyCount,
    disputesActiveCount,
    paymentLedgerFailed7dCount,
    disputesActiveItems,
    prestaPayoutReadyItems,
    tiakPayoutReadyItems,
    paymentFailedItems,
  ] = await Promise.all([
    prisma.prestaPayout.count({ where: { status: "READY" } }).catch(() => null),
    prisma.tiakPayout.count({ where: { status: "READY" } }).catch(() => null),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }).catch(() => null),
    prisma.paymentLedger
      .count({ where: { status: "FAILED", createdAt: { gte: last7Days } } })
      .catch(() => null),
    prisma.dispute
      .findMany({
        where: { status: { in: ["OPEN", "IN_REVIEW"] } },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: {
          id: true,
          contextType: true,
          contextId: true,
          status: true,
          createdAt: true,
        },
      })
      .catch(() => null),
    prisma.prestaPayout
      .findMany({
        where: { status: "READY" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: {
          id: true,
          bookingId: true,
          status: true,
          amountTotalCents: true,
          currency: true,
          createdAt: true,
        },
      })
      .catch(() => null),
    prisma.tiakPayout
      .findMany({
        where: { status: "READY" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: {
          id: true,
          deliveryId: true,
          status: true,
          amountTotalCents: true,
          currency: true,
          createdAt: true,
        },
      })
      .catch(() => null),
    prisma.paymentLedger
      .findMany({
        where: { status: "FAILED", createdAt: { gte: last7Days } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          contextType: true,
          contextId: true,
          status: true,
          amountTotalCents: true,
          currency: true,
          createdAt: true,
        },
      })
      .catch(() => null),
  ]);

  const formatAgeLabel = (date: Date) => {
    const diff = Math.max(0, now.getTime() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  type OpsQueueItem = {
    type: "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED";
    id: string;
    refLabel: string;
    status: string;
    ageLabel: string;
    amountLabel?: string;
    action:
      | { kind: "release"; label: string; releaseType: "PRESTA" | "TIAK" }
      | { kind: "link"; label: string; href: string };
    createdAtMs: number;
  };

  const queueWithSort: OpsQueueItem[] = [
    ...((prestaPayoutReadyItems ?? []).map((item) => ({
      type: "PAYOUT" as const,
      id: item.id,
      refLabel: `PRESTA - ${item.bookingId}`,
      status: item.status,
      ageLabel: formatAgeLabel(item.createdAt),
      amountLabel: formatMoney(item.amountTotalCents, item.currency, locale),
      action: { kind: "release" as const, label: "Release", releaseType: "PRESTA" as const },
      createdAtMs: item.createdAt.getTime(),
    }))),
    ...((tiakPayoutReadyItems ?? []).map((item) => ({
      type: "PAYOUT" as const,
      id: item.id,
      refLabel: `TIAK - ${item.deliveryId}`,
      status: item.status,
      ageLabel: formatAgeLabel(item.createdAt),
      amountLabel: formatMoney(item.amountTotalCents, item.currency, locale),
      action: { kind: "release" as const, label: "Release", releaseType: "TIAK" as const },
      createdAtMs: item.createdAt.getTime(),
    }))),
    ...((disputesActiveItems ?? []).map((item) => ({
      type: "DISPUTE" as const,
      id: item.id,
      refLabel: `${item.contextType} - ${item.contextId}`,
      status: item.status,
      ageLabel: formatAgeLabel(item.createdAt),
      action: {
        kind: "link" as const,
        label: "Open dispute",
        href: `/admin?opsFilter=DISPUTES&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAt.getTime(),
    }))),
    ...((paymentFailedItems ?? []).map((item) => ({
      type: "PAYMENT_FAILED" as const,
      id: item.id,
      refLabel: `${item.contextType} - ${item.contextId}`,
      status: item.status,
      ageLabel: formatAgeLabel(item.createdAt),
      amountLabel: formatMoney(item.amountTotalCents, item.currency, locale),
      action: {
        kind: "link" as const,
        label: "Inspect",
        href: `/admin?opsFilter=PAYMENTS_FAILED&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAt.getTime(),
    }))),
  ];

  const queuePriority: Record<OpsQueueItem["type"], number> = {
    PAYOUT: 0,
    DISPUTE: 1,
    PAYMENT_FAILED: 2,
  };

  const opsQueueItems = queueWithSort
    .sort((a, b) => {
      if (queuePriority[a.type] !== queuePriority[b.type]) {
        return queuePriority[a.type] - queuePriority[b.type];
      }
      if (a.type === "PAYMENT_FAILED") {
        return b.createdAtMs - a.createdAtMs;
      }
      return a.createdAtMs - b.createdAtMs;
    })
    .slice(0, 20)
    .map(({ createdAtMs, ...item }) => item);

  const opsKpis = {
    payoutsReady:
      typeof prestaPayoutReadyCount === "number" && typeof tiakPayoutReadyCount === "number"
        ? prestaPayoutReadyCount + tiakPayoutReadyCount
        : null,
    disputesActive: typeof disputesActiveCount === "number" ? disputesActiveCount : null,
    paymentsFailed7d:
      typeof paymentLedgerFailed7dCount === "number" ? paymentLedgerFailed7dCount : null,
    kycPending: typeof pendingKycCount === "number" ? pendingKycCount : null,
  };

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
        <Link
          href="/seller"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.seller")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-300/15 via-zinc-900 to-zinc-900 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
            {t("hero.kicker")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">{t("hero.subtitle")}</p>
        </section>

                <section className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: t("kpis.revenueTotal"),
              value: formatMoney(revenueTotal._sum.totalCents ?? 0, "XOF", locale),
            },
            {
              label: t("kpis.revenueMonth"),
              value: formatMoney(revenueMonth._sum.totalCents ?? 0, "XOF", locale),
            },
            {
              label: t("kpis.avgOrder"),
              value: formatMoney(Math.round(avgOrder._avg.totalCents ?? 0), "XOF", locale),
            },
            {
              label: t("kpis.ordersToday"),
              value: ordersTodayCount,
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

        <AdminOpsHub kpis={opsKpis} queueItems={opsQueueItems} />

        <AdminTrendsPanel
          dates={trendDates}
          revenueSeries={revenueSeries}
          ordersSeries={ordersSeries}
          usersSeries={usersSeries}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t("topProducts.title")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("topProducts.subtitle")}</p>
              </div>
              <Link
                href="/admin/products"
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
              >
                {t("topProducts.cta")}
              </Link>
            </div>
            {topItems.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">{t("topProducts.empty")}</p>
            )}
            {topItems.length > 0 && (
              <div className="mt-5 grid gap-3">
                {topItems.map((item) => {
                  const product = topProductMap.get(item.productId);
                  const units = item._sum.quantity ?? 0;
                  const width = Math.max(8, Math.round((units / topProductMax) * 100));
                  return (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {product?.title ?? t("topProducts.unknownProduct")}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {product?.seller?.displayName ?? t("topProducts.unknownSeller")}
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
                <h2 className="text-xl font-semibold">{t("topSellers.title")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("topSellers.subtitle")}</p>
              </div>
              <Link
                href="/admin/users"
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
              >
                {t("topSellers.cta")}
              </Link>
            </div>
            {topSellers.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">{t("topSellers.empty")}</p>
            )}
            {topSellers.length > 0 && (
              <div className="mt-5 grid gap-3">
                {topSellers.map((seller) => {
                  const width = Math.max(
                    8,
                    Math.round((seller.revenueCents / topSellerMax) * 100)
                  );
                  return (
                    <div
                      key={seller.id || seller.name}
                      className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{seller.name}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {t("topSellers.orders", { count: seller.orders })}
                          </p>
                        </div>
                        <div className="text-sky-200">
                          {formatMoney(seller.revenueCents, "XOF", locale)}
                        </div>
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
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <h2 className="text-xl font-semibold">{t("alerts.title")}</h2>
          <p className="mt-2 text-sm text-zinc-300">{t("alerts.subtitle")}</p>
          <div className="mt-4 grid gap-3 text-xs text-zinc-200">
            {pendingKycCount === 0 &&
            pendingOrdersCount === 0 &&
            failedPaymentsCount === 0 &&
            inactiveProductsCount === 0 ? (
              <p className="text-xs text-zinc-400">{t("alerts.empty")}</p>
            ) : (
              <>
                <Link
                  href="/admin/kyc"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3"
                >
                  <span>{t("alerts.kyc")}</span>
                  <span className="text-amber-200">{pendingKycCount}</span>
                </Link>
                <Link
                  href="/admin/orders"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3"
                >
                  <span>{t("alerts.orders")}</span>
                  <span className="text-amber-200">{pendingOrdersCount}</span>
                </Link>
                <Link
                  href="/admin/orders"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3"
                >
                  <span>{t("alerts.payments")}</span>
                  <span className="text-rose-200">{failedPaymentsCount}</span>
                </Link>
                <Link
                  href="/admin/products"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3"
                >
                  <span>{t("alerts.products")}</span>
                  <span className="text-amber-200">{inactiveProductsCount}</span>
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6"
            >
              <p className="text-xs font-semibold text-sky-200">
                {t(`stats.${index}.label`)}
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {t(`stats.${index}.value`)}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {t(`stats.${index}.note`)}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h2 className="text-xl font-semibold">{t("cards.vendors")}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {t("cards.vendorsDesc")}
            </p>
            <div className="mt-6 grid gap-3 text-xs text-zinc-400">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.vendorsLine1")}
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.vendorsLine2")}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h2 className="text-xl font-semibold">{t("cards.catalog")}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {t("cards.catalogDesc")}
            </p>
            <div className="mt-6 grid gap-3 text-xs text-zinc-400">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.catalogLine1")}
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.catalogLine2")}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-sky-300/10 p-8">
          <h2 className="text-xl font-semibold">{t("compliance.title")}</h2>
          <p className="mt-2 text-sm text-zinc-300">
            {t("compliance.desc")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-sky-400/20 px-3 py-1 text-xs text-sky-200">
              {t("compliance.badge1")}
            </span>
            <span className="rounded-full bg-sky-400/20 px-3 py-1 text-xs text-sky-200">
              {t("compliance.badge2")}
            </span>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: t("orders.title"),
                subtitle: t("orders.subtitle"),
                cta: t("orders.cta"),
                href: "/admin/orders",
              },
              {
                title: t("users.title"),
                subtitle: t("users.subtitle"),
                cta: t("users.cta"),
                href: "/admin/users",
              },
              {
                title: t("kyc.title"),
                subtitle: t("kyc.subtitle"),
                cta: t("kyc.cta"),
                href: "/admin/kyc",
              },
              {
                title: t("products.title"),
                subtitle: t("products.subtitle"),
                cta: t("products.cta"),
                href: "/admin/products",
              },
              {
                title: t("categories.title"),
                subtitle: t("categories.subtitle"),
                cta: t("categories.cta"),
                href: "/admin/categories",
              },
              {
                title: t("stores.title"),
                subtitle: t("stores.subtitle"),
                cta: t("stores.cta"),
                href: "/admin/stores",
              },
              {
                title: t("sellers.title"),
                subtitle: t("sellers.subtitle"),
                cta: t("sellers.cta"),
                href: "/admin/sellers",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
              >
                <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-xs text-zinc-400">{card.subtitle}</p>
                <Link
                  href={card.href}
                  className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
                >
                  {card.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
