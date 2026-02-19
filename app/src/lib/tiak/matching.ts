import { prisma } from "@/lib/prisma";

type CourierScore = {
  courierId: string;
  name: string | null;
  image: string | null;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  zones: string[];
  cities: string[];
  activeJobsCount: number;
  score: number;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function toArea(address: string) {
  const base = address.split(",")[0]?.trim() || address.trim();
  return base.slice(0, 72);
}

function isZoneMatch(zones: string[], pickupArea: string) {
  const needle = normalize(pickupArea);
  if (!needle) return false;
  return zones.some((entry) => normalize(entry) === needle);
}

function isCityMatch(cities: string[], pickupAddress: string) {
  const haystack = normalize(pickupAddress);
  if (!haystack) return false;
  return cities.some((entry) => {
    const city = normalize(entry);
    return city.length > 0 && haystack.includes(city);
  });
}

export async function scoreCouriersForDelivery(deliveryId: string, take = 5): Promise<CourierScore[]> {
  const delivery = await prisma.tiakDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      pickupAddress: true,
    },
  });

  if (!delivery) {
    return [];
  }

  const pickupArea = toArea(delivery.pickupAddress);

  const profiles = await prisma.tiakCourierProfile.findMany({
    where: {
      isActive: true,
    },
    take: 60,
    orderBy: [{ updatedAt: "desc" }],
    select: {
      courierId: true,
      isActive: true,
      areas: true,
      cities: true,
      courier: {
        select: {
          id: true,
          name: true,
          image: true,
          transporterRating: true,
          transporterReviewCount: true,
        },
      },
    },
  });

  if (profiles.length === 0) {
    return [];
  }

  const activeByCourier = await prisma.tiakDelivery.groupBy({
    by: ["courierId"],
    where: {
      courierId: { in: profiles.map((profile) => profile.courierId) },
      status: { in: ["REQUESTED", "ACCEPTED", "PICKED_UP"] },
    },
    _count: { _all: true },
  });

  const load = new Map<string, number>();
  for (const row of activeByCourier) {
    if (row.courierId) {
      load.set(row.courierId, row._count._all);
    }
  }

  return profiles
    .map((profile) => {
      const zoneMatch = isZoneMatch(profile.areas, pickupArea) || isCityMatch(profile.cities, delivery.pickupAddress);
      const ratingScore = Math.max(0, Math.min(20, Math.round((profile.courier.transporterRating ?? 0) * 4)));
      const activeJobsCount = load.get(profile.courierId) ?? 0;
      const loadPenalty = Math.min(10, activeJobsCount);
      const score = (profile.isActive ? 50 : 0) + (zoneMatch ? 30 : 0) + ratingScore - loadPenalty;

      return {
        courierId: profile.courier.id,
        name: profile.courier.name,
        image: profile.courier.image,
        ratingAvg: profile.courier.transporterRating,
        ratingCount: profile.courier.transporterReviewCount,
        isOnline: profile.isActive,
        zones: profile.areas,
        cities: profile.cities,
        activeJobsCount,
        score,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.courierId.localeCompare(b.courierId);
    })
    .slice(0, Math.max(1, Math.min(take, 10)));
}

