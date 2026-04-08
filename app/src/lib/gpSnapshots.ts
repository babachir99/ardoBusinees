import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const allowedCurrencies = new Set(["XOF", "EUR", "USD"]);

export type GpMarketplaceFilters = {
  from: string;
  to: string;
  departureDate: string;
  minPrice: string;
  maxPrice: string;
  currency: string;
};

function buildGpMarketplaceWhere(storeId: string, filters: GpMarketplaceFilters) {
  const where: Record<string, unknown> = {
    storeId,
    isActive: true,
    status: "OPEN",
  };

  if (filters.from) {
    where.originCity = { contains: filters.from, mode: "insensitive" };
  }

  if (filters.to) {
    where.destinationCity = { contains: filters.to, mode: "insensitive" };
  }

  if (filters.departureDate) {
    const start = new Date(`${filters.departureDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.flightDate = { gte: start, lt: end };
    }
  }

  const normalizedCurrency = filters.currency.trim().toUpperCase();
  if (allowedCurrencies.has(normalizedCurrency)) {
    where.currency = normalizedCurrency;

    const parsedMinPrice = Number(filters.minPrice);
    const parsedMaxPrice = Number(filters.maxPrice);
    const hasMinPrice = Number.isFinite(parsedMinPrice) && parsedMinPrice > 0;
    const hasMaxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice > 0;

    if (hasMinPrice || hasMaxPrice) {
      where.pricePerKgCents = {
        ...(hasMinPrice ? { gte: Math.trunc(parsedMinPrice) } : {}),
        ...(hasMaxPrice ? { lte: Math.trunc(parsedMaxPrice) } : {}),
      };
    }
  }

  return where;
}

export const getGpStoreSnapshot = unstable_cache(
  async () =>
    prisma.store.findUnique({
      where: { slug: "jontaado-gp" },
      select: { id: true, name: true, description: true },
    }),
  ["gp-store-snapshot"],
  { revalidate: 300 }
);

export const getGpMarketplaceSnapshot = unstable_cache(
  async (storeId: string, filters: GpMarketplaceFilters) => {
    const where = buildGpMarketplaceWhere(storeId, filters);
    const [trips, totalTrips, activeTransporters] = await Promise.all([
      prisma.gpTrip.findMany({
        where,
        orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          transporterId: true,
          originCity: true,
          destinationCity: true,
          originAddress: true,
          destinationAddress: true,
          flightDate: true,
          deliveryStartAt: true,
          deliveryEndAt: true,
          availableKg: true,
          pricePerKgCents: true,
          currency: true,
          maxPackages: true,
          notes: true,
          acceptedPaymentMethods: true,
          transporter: {
            select: {
              id: true,
              name: true,
              transporterRating: true,
              transporterReviewCount: true,
            },
          },
        },
        take: 60,
      }),
      prisma.gpTrip.count({
        where: { storeId, isActive: true, status: "OPEN" },
      }),
      prisma.gpTrip.findMany({
        where: { storeId, isActive: true, status: "OPEN" },
        distinct: ["transporterId"],
        select: { transporterId: true },
      }),
    ]);

    return {
      totalTrips,
      activeTransportersCount: activeTransporters.length,
      trips: trips.map((trip) => ({
        ...trip,
        flightDate: trip.flightDate.toISOString(),
        deliveryStartAt: trip.deliveryStartAt?.toISOString() ?? null,
        deliveryEndAt: trip.deliveryEndAt?.toISOString() ?? null,
      })),
    };
  },
  ["gp-marketplace-snapshot"],
  { revalidate: 30 }
);
