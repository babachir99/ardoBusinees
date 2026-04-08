import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getHomePromoEntries } from "@/lib/homePromos";
import { isHomePromoScheduledLive } from "@/lib/homePromos.shared";

export const getAdminDashboardSnapshot = unstable_cache(
  async () => {
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
      pendingKycCount,
      ordersTodayCount,
      pendingOrdersCount,
      inactiveProductsCount,
      revenueTotal,
      revenueMonth,
      avgOrder,
      recentOrders,
      recentUsers,
      topItems,
      topSellerStats,
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
      homePromoConfig,
    ] = await Promise.all([
      prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.product.count({ where: { isActive: false } }),
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
      prisma.immoMonetizationPurchase
        .count({
          where: {
            status: { in: ["PENDING", "FAILED"] },
            createdAt: { gte: last7Days },
          },
        })
        .catch(() => null),
      prisma.immoMonetizationPurchase
        .findMany({
          where: {
            status: { in: ["PENDING", "FAILED", "CONFIRMED"] },
            createdAt: { gte: last7Days },
          },
          orderBy: [{ createdAt: "asc" }],
          take: 20,
          select: {
            id: true,
            listingId: true,
            status: true,
            amountCents: true,
            currency: true,
            createdAt: true,
            kind: true,
            paymentLedger: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        })
        .catch(() => null),
      prisma.autoMonetizationPurchase
        .count({
          where: {
            status: { in: ["PENDING", "FAILED"] },
            createdAt: { gte: last7Days },
          },
        })
        .catch(() => null),
      prisma.autoMonetizationPurchase
        .findMany({
          where: {
            status: { in: ["PENDING", "FAILED", "CONFIRMED"] },
            createdAt: { gte: last7Days },
          },
          orderBy: [{ createdAt: "asc" }],
          take: 20,
          select: {
            id: true,
            listingId: true,
            status: true,
            amountCents: true,
            currency: true,
            createdAt: true,
            kind: true,
            paymentLedger: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        })
        .catch(() => null),
      prisma.carMonetizationPurchase
        .count({
          where: {
            status: { in: ["PENDING", "FAILED"] },
            createdAt: { gte: last7Days },
          },
        })
        .catch(() => null),
      prisma.carMonetizationPurchase
        .findMany({
          where: {
            status: { in: ["PENDING", "FAILED", "CONFIRMED"] },
            createdAt: { gte: last7Days },
          },
          orderBy: [{ createdAt: "asc" }],
          take: 20,
          select: {
            id: true,
            listingId: true,
            status: true,
            amountCents: true,
            currency: true,
            createdAt: true,
            kind: true,
            paymentLedger: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        })
        .catch(() => null),
      prisma.report.count({ where: { status: "PENDING" } }).catch(() => null),
      prisma.trustDispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }).catch(() => null),
      prisma.report
        .findMany({
          where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: {
            id: true,
            reporterId: true,
            reportedId: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        })
        .catch(() => null),
      prisma.trustDispute
        .findMany({
          where: { status: { in: ["OPEN", "IN_REVIEW"] } },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: {
            id: true,
            vertical: true,
            orderId: true,
            userId: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        })
        .catch(() => null),
      getHomePromoEntries(),
    ]);

    const topProductIds = topItems.map((item) => item.productId);
    const topSellerIds = topSellerStats
      .map((stat) => stat.sellerId)
      .filter((id): id is string => Boolean(id));

    const [topProducts, sellerProfiles] = await Promise.all([
      topProductIds.length
        ? prisma.product.findMany({
            where: { id: { in: topProductIds } },
            select: { id: true, title: true, slug: true, seller: { select: { displayName: true } } },
          })
        : Promise.resolve([]),
      topSellerIds.length
        ? prisma.sellerProfile.findMany({
            where: { id: { in: topSellerIds } },
            select: {
              id: true,
              displayName: true,
              slug: true,
              user: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const topProductMap = new Map(topProducts.map((product) => [product.id, product]));
    const sellerMap = new Map(sellerProfiles.map((seller) => [seller.id, seller]));

    return {
      pendingKycCount,
      ordersTodayCount,
      pendingOrdersCount,
      inactiveProductsCount,
      revenueTotalCents: revenueTotal._sum.totalCents ?? 0,
      revenueMonthCents: revenueMonth._sum.totalCents ?? 0,
      avgOrderCents: Math.round(avgOrder._avg.totalCents ?? 0),
      recentOrders: recentOrders.map((order) => ({
        totalCents: order.totalCents,
        paymentStatus: order.paymentStatus,
        createdAtMs: order.createdAt.getTime(),
      })),
      recentUsers: recentUsers.map((user) => ({
        createdAtMs: user.createdAt.getTime(),
      })),
      topProducts: topItems.map((item) => {
        const product = topProductMap.get(item.productId);
        return {
          id: item.productId,
          title: product?.title ?? null,
          sellerName: product?.seller?.displayName ?? null,
          units: item._sum.quantity ?? 0,
        };
      }),
      topSellers: topSellerStats.map((stat) => {
        const seller = stat.sellerId ? sellerMap.get(stat.sellerId) : undefined;
        return {
          id: stat.sellerId ?? "",
          name: seller?.displayName ?? seller?.user?.name ?? seller?.user?.email ?? null,
          slug: seller?.slug ?? null,
          revenueCents: stat._sum.totalCents ?? 0,
          orders: stat._count._all ?? 0,
        };
      }),
      prestaPayoutReadyCount,
      tiakPayoutReadyCount,
      disputesActiveCount,
      paymentLedgerFailed7dCount,
      disputesActiveItems: (disputesActiveItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      prestaPayoutReadyItems: (prestaPayoutReadyItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      tiakPayoutReadyItems: (tiakPayoutReadyItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      paymentFailedItems: (paymentFailedItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      immoMonetizationIssueCount,
      immoMonetizationItems: (immoMonetizationItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      autoMonetizationIssueCount,
      autoMonetizationItems: (autoMonetizationItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      carsMonetizationIssueCount,
      carsMonetizationItems: (carsMonetizationItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      trustReportsPendingCount,
      trustDisputesActiveCount,
      trustReportItems: (trustReportItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      trustDisputeItems: (trustDisputeItems ?? []).map((item) => ({
        ...item,
        createdAtMs: item.createdAt.getTime(),
      })),
      configuredSponsoredCampaigns: homePromoConfig.entries.length,
      liveSponsoredCampaigns: homePromoConfig.entries.filter((entry) =>
        isHomePromoScheduledLive(entry, now)
      ).length,
    };
  },
  ["admin-dashboard-snapshot"],
  { revalidate: 30 }
);
