import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Footer from "@/components/layout/Footer";
import AdminTrendsPanel from "@/components/admin/AdminTrendsPanel";
import AdminOpsHub from "@/components/admin/AdminOpsHub";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { hasUserRole } from "@/lib/userRoles";
import { getAdminDashboardSnapshot } from "@/lib/adminDashboardSnapshot";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();
  const t = await getTranslations("Admin");

  if (!session || !hasUserRole(session.user, "ADMIN")) {
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
  const trendDays = 30;
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (trendDays - 1));

  const {
    pendingKycCount,
    ordersTodayCount,
    pendingOrdersCount,
    inactiveProductsCount,
    revenueTotalCents,
    revenueMonthCents,
    avgOrderCents,
    recentOrders,
    recentUsers,
    topProducts,
    topSellers,
    prestaPayoutReadyCount,
    tiakPayoutReadyCount,
    disputesActiveCount,
    paymentLedgerFailed7dCount,
    disputesActiveItems,
    prestaPayoutReadyItems,
    tiakPayoutReadyItems,
    paymentFailedItems,
    immoMonetizationIssueCount,
    immoMonetizationItems,
    autoMonetizationIssueCount,
    autoMonetizationItems,
    carsMonetizationIssueCount,
    carsMonetizationItems,
    trustReportsPendingCount,
    trustDisputesActiveCount,
    trustReportItems,
    trustDisputeItems,
    liveSponsoredCampaigns,
    configuredSponsoredCampaigns,
  } = await getAdminDashboardSnapshot();

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
    const key = dayKey(new Date(order.createdAtMs));
    if (key in ordersByDay) {
      ordersByDay[key] += 1;
      if (order.paymentStatus === "PAID") {
        revenueByDay[key] += order.totalCents;
      }
    }
  }

  for (const user of recentUsers) {
    const key = dayKey(new Date(user.createdAtMs));
    if (key in usersByDay) {
      usersByDay[key] += 1;
    }
  }

  const revenueSeries = trendDates.map((d) => revenueByDay[d.key] ?? 0);
  const ordersSeries = trendDates.map((d) => ordersByDay[d.key] ?? 0);
  const usersSeries = trendDates.map((d) => usersByDay[d.key] ?? 0);
  const topProductMax = Math.max(
    ...topProducts.map((item) => item.units),
    1
  );
  const topSellerMax = Math.max(
    ...topSellers.map((seller) => seller.revenueCents),
    1
  );

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
    type: "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED" | "IMMO_MONETIZATION" | "AUTO_MONETIZATION" | "CARS_MONETIZATION" | "TRUST";
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
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      amountLabel: formatMoney(item.amountTotalCents, item.currency, locale),
      action: { kind: "release" as const, label: t("opsHub.actions.release"), releaseType: "PRESTA" as const },
      createdAtMs: item.createdAtMs,
    }))),
    ...((tiakPayoutReadyItems ?? []).map((item) => ({
      type: "PAYOUT" as const,
      id: item.id,
      refLabel: `TIAK - ${item.deliveryId}`,
      status: item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      amountLabel: formatMoney(item.amountTotalCents, item.currency, locale),
      action: { kind: "release" as const, label: t("opsHub.actions.release"), releaseType: "TIAK" as const },
      createdAtMs: item.createdAtMs,
    }))),
    ...((disputesActiveItems ?? []).map((item) => ({
      type: "DISPUTE" as const,
      id: item.id,
      refLabel: `${item.contextType} - ${item.contextId}`,
      status: item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.openDispute"),
        href: `/admin?opsFilter=DISPUTE&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAtMs,
    }))),
    ...((paymentFailedItems ?? []).map((item) => ({
      type: "PAYMENT_FAILED" as const,
      id: item.id,
      refLabel: `${item.contextType} - ${item.contextId}`,
      status: item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      amountLabel: formatMoney(item.amountTotalCents, item.currency, locale),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.inspect"),
        href: `/admin?opsFilter=PAYMENT_FAILED&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAtMs,
    }))),
    ...((immoMonetizationItems ?? []).map((item) => ({
      type: "IMMO_MONETIZATION" as const,
      id: item.id,
      refLabel: `${item.kind} - ${item.listingId}`,
      status: item.paymentLedger?.status ?? item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      amountLabel: formatMoney(item.amountCents, item.currency, locale),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.inspect"),
        href: `/admin?opsFilter=IMMO_MONETIZATION&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAtMs,
    }))),
    ...((autoMonetizationItems ?? []).map((item) => ({
      type: "AUTO_MONETIZATION" as const,
      id: item.id,
      refLabel: `${item.kind} - ${item.listingId}`,
      status: item.paymentLedger?.status ?? item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      amountLabel: formatMoney(item.amountCents, item.currency, locale),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.inspect"),
        href: `/admin?opsFilter=AUTO_MONETIZATION&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAtMs,
    }))),
    ...((carsMonetizationItems ?? []).map((item) => ({
      type: "CARS_MONETIZATION" as const,
      id: item.id,
      refLabel: `${item.kind} - ${item.listingId}`,
      status: item.paymentLedger?.status ?? item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      amountLabel: formatMoney(item.amountCents, item.currency, locale),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.inspect"),
        href: `/admin?opsFilter=CARS_MONETIZATION&focus=${item.id}#ops-queue`,
      },
      createdAtMs: item.createdAtMs,
    }))),
    ...((trustReportItems ?? []).map((item) => ({
      type: "TRUST" as const,
      id: item.id,
      refLabel: `Report - ${item.reportedId}`,
      status: item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.inspect"),
        href: `/admin/trust?tab=reports&focus=${item.id}`,
      },
      createdAtMs: item.createdAtMs,
    }))),
    ...((trustDisputeItems ?? []).map((item) => ({
      type: "TRUST" as const,
      id: item.id,
      refLabel: `Trust dispute - ${item.vertical}${item.orderId ? ` - ${item.orderId}` : ""}`,
      status: item.status,
      ageLabel: formatAgeLabel(new Date(item.createdAtMs)),
      action: {
        kind: "link" as const,
        label: t("opsHub.actions.openDispute"),
        href: `/admin/trust?tab=disputes&focus=${item.id}`,
      },
      createdAtMs: item.createdAtMs,
    }))),
  ];

  const queuePriority: Record<OpsQueueItem["type"], number> = {
    PAYOUT: 0,
    DISPUTE: 1,
    IMMO_MONETIZATION: 2,
    AUTO_MONETIZATION: 2,
    CARS_MONETIZATION: 2,
    TRUST: 1,
    PAYMENT_FAILED: 3,
  };

  const opsQueueItems = queueWithSort
    .sort((a, b) => {
      if (queuePriority[a.type] !== queuePriority[b.type]) {
        return queuePriority[a.type] - queuePriority[b.type];
      }
      if (a.type === "PAYMENT_FAILED") {
        return b.createdAtMs - a.createdAtMs;
      }
      if (a.type === "IMMO_MONETIZATION" || a.type === "AUTO_MONETIZATION" || a.type === "CARS_MONETIZATION") {
        return b.createdAtMs - a.createdAtMs;
      }
      return a.createdAtMs - b.createdAtMs;
    })
    .slice(0, 20);

  const opsKpis = {
    payoutsReady:
      typeof prestaPayoutReadyCount === "number" && typeof tiakPayoutReadyCount === "number"
        ? prestaPayoutReadyCount + tiakPayoutReadyCount
        : null,
    disputesActive: typeof disputesActiveCount === "number" ? disputesActiveCount : null,
    paymentsFailed7d:
      typeof paymentLedgerFailed7dCount === "number" ? paymentLedgerFailed7dCount : null,
    pendingOrders: typeof pendingOrdersCount === "number" ? pendingOrdersCount : null,
    inactiveProducts: typeof inactiveProductsCount === "number" ? inactiveProductsCount : null,
    kycPending: typeof pendingKycCount === "number" ? pendingKycCount : null,
    immoMonetizationIssues:
      typeof immoMonetizationIssueCount === "number" ? immoMonetizationIssueCount : null,
    autoMonetizationIssues:
      typeof autoMonetizationIssueCount === "number" ? autoMonetizationIssueCount : null,
    carsMonetizationIssues:
      typeof carsMonetizationIssueCount === "number" ? carsMonetizationIssueCount : null,
    trustReportsPending:
      typeof trustReportsPendingCount === "number" ? trustReportsPendingCount : null,
    trustDisputesActive:
      typeof trustDisputesActiveCount === "number" ? trustDisputesActiveCount : null,
  };

  const opsInsights = {
    productsHref: "/admin/products",
    sellersHref: "/admin/users",
    products: topProducts.map((item) => {
      const units = item.units;
      return {
        id: item.id,
        title: item.title ?? t("topProducts.unknownProduct"),
        sellerName: item.sellerName ?? t("topProducts.unknownSeller"),
        units,
        barPercent: Math.max(8, Math.round((units / topProductMax) * 100)),
      };
    }),
    sellers: topSellers.map((seller) => ({
      id: seller.id || seller.name || t("topSellers.unknownSeller"),
      name: seller.name ?? t("topSellers.unknownSeller"),
      orders: seller.orders,
      revenueLabel: formatMoney(seller.revenueCents, "XOF", locale),
      barPercent: Math.max(8, Math.round((seller.revenueCents / topSellerMax) * 100)),
    })),
  };

  const isFr = locale.toLowerCase().startsWith("fr");

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 fade-up">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[105px] w-auto md:h-[120px]"
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/40 hover:bg-emerald-400/15"
          >
            <span>{isFr ? "Campagnes" : "Campaigns"}</span>
            <span className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-[10px] font-bold text-emerald-50">
              {liveSponsoredCampaigns}
            </span>
          </Link>
          <Link
            href="/seller"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("nav.seller")}
          </Link>
          <Link
            href="/admin/orders"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("orders.cta")}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-24">
        <AdminOpsHub kpis={opsKpis} queueItems={opsQueueItems} insights={opsInsights} />

        <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">{isFr ? "Business Snapshot" : "Business Snapshot"}</h2>
            <p className="mt-1 text-xs text-zinc-400">{isFr ? "Performance commerciale consolid?e." : "Consolidated business performance."}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: t("kpis.revenueTotal"),
                value: formatMoney(revenueTotalCents, "XOF", locale),
              },
              {
                label: t("kpis.revenueMonth"),
                value: formatMoney(revenueMonthCents, "XOF", locale),
              },
              {
                label: t("kpis.avgOrder"),
                value: formatMoney(avgOrderCents, "XOF", locale),
              },
              {
                label: t("kpis.ordersToday"),
                value: ordersTodayCount,
              },
            ].map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/35"
              >
                <p className="text-xs text-zinc-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
              </article>
            ))}
          </div>
        </section>

        <AdminTrendsPanel
          dates={trendDates}
          revenueSeries={revenueSeries}
          ordersSeries={ordersSeries}
          usersSeries={usersSeries}
        />

        <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-6 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">{isFr ? "Raccourcis admin" : "Admin shortcuts"}</h2>
            <p className="mt-1 text-xs text-zinc-400">{isFr ? "Acces direct aux outils critiques du back-office." : "Direct access to critical back-office tools."}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                title: isFr ? "Trust Center" : "Trust Center",
                subtitle: isFr ? "Signalements, litiges et moderation" : "Reports, disputes and moderation",
                cta: isFr ? "Ouvrir" : "Open",
                href: "/admin/trust",
              },
              {
                title: "Monetization",
                subtitle: isFr ? "IMMO / AUTO / CARS" : "IMMO / AUTO / CARS",
                cta: isFr ? "Ouvrir" : "Open",
                href: "/admin/immo/monetization",
              },
              {
                title: isFr ? "Campagnes sponsorisees" : "Sponsored campaigns",
                subtitle: isFr
                  ? "Gestion pubs homepage, verticales et rotations"
                  : "Manage homepage ads, verticals, and rotations",
                cta: isFr ? "Gerer" : "Manage",
                href: "/admin/campaigns",
              },
            ].map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                  {card.href === "/admin/campaigns" ? (
                    <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                      {liveSponsoredCampaigns}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-zinc-400">{card.subtitle}</p>
                {card.href === "/admin/campaigns" ? (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {isFr
                      ? `${configuredSponsoredCampaigns} campagne(s) configuree(s) · ${liveSponsoredCampaigns} active(s)`
                      : `${configuredSponsoredCampaigns} campaign(s) configured · ${liveSponsoredCampaigns} live`}
                  </p>
                ) : null}
                <Link
                  href={card.href}
                  className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
                >
                  {card.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
