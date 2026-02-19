import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function toArea(address: string) {
  const base = address.split(",")[0]?.trim() || address.trim();
  return base.slice(0, 72);
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

type CourierCandidate = {
  id: string;
  courierId: string;
  isActive: boolean;
  cities: string[];
  areas: string[];
  updatedAt: Date;
  courier: {
    id: string;
    name: string | null;
    image: string | null;
    transporterRating: number;
    transporterReviewCount: number;
  };
};

function includesArea(entries: string[], pickupArea: string) {
  const normalizedArea = normalizeString(pickupArea);
  if (!normalizedArea) return false;
  return entries.some((entry) => normalizeString(entry) === normalizedArea);
}

function includesCity(entries: string[], pickupAddress: string) {
  const normalized = normalizeString(pickupAddress);
  if (!normalized) return false;
  return entries.some((entry) => {
    const city = normalizeString(entry);
    return city.length > 0 && normalized.includes(city);
  });
}

function etaLabel(score: number, locale: string) {
  if (score >= 75) return locale === "fr" ? "~15-25 min" : "~15-25 min";
  if (score >= 55) return locale === "fr" ? "~25-40 min" : "~25-40 min";
  return locale === "fr" ? "~40-60 min" : "~40-60 min";
}

export async function GET(request: NextRequest) {
  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        customerId: string;
        status: string;
        pickupAddress: string;
      } | null>;
    };
    tiakCourierProfile?: {
      findMany: (args: unknown) => Promise<CourierCandidate[]>;
    };
  };

  if (!runtimePrisma.tiakDelivery || !runtimePrisma.tiakCourierProfile) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const jobId = String(searchParams.get("jobId") ?? "").trim();
  const take = normalizeTake(searchParams.get("take"), 5, 5);
  const locale = searchParams.get("locale") === "fr" ? "fr" : "en";

  if (!jobId) {
    return errorResponse(400, "JOB_ID_REQUIRED", "jobId is required.");
  }

  try {
    const job = await runtimePrisma.tiakDelivery.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        status: true,
        pickupAddress: true,
      },
    });

    if (!job) {
      return errorResponse(404, "JOB_NOT_FOUND", "Tiak job not found.");
    }

    const pickupArea = toArea(job.pickupAddress);

    const profiles = await runtimePrisma.tiakCourierProfile.findMany({
      where: { isActive: true },
      take: 60,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        courierId: true,
        isActive: true,
        cities: true,
        areas: true,
        updatedAt: true,
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

    const loadCounters = await prisma.tiakDelivery.groupBy({
      by: ["courierId"],
      where: {
        courierId: { in: profiles.map((profile) => profile.courierId) },
        status: { in: ["ACCEPTED", "PICKED_UP"] },
      },
      _count: {
        _all: true,
      },
    });

    const loadByCourier = new Map<string, number>();
    for (const row of loadCounters) {
      if (row.courierId) {
        loadByCourier.set(row.courierId, row._count._all);
      }
    }

    const scored = profiles
      .map((profile) => {
        const zoneMatch =
          includesArea(profile.areas, pickupArea) ||
          includesCity(profile.cities, job.pickupAddress);
        const ratingScore = Math.max(
          0,
          Math.min(20, Math.round((profile.courier.transporterRating ?? 0) * 4))
        );
        const activeJobs = loadByCourier.get(profile.courierId) ?? 0;
        const loadPenalty = Math.min(10, activeJobs);

        const score =
          (profile.isActive ? 50 : 0) +
          (zoneMatch ? 30 : 0) +
          ratingScore -
          loadPenalty;

        return {
          id: profile.courier.id,
          name: profile.courier.name,
          image: profile.courier.image,
          ratingAvg: profile.courier.transporterRating,
          ratingCount: profile.courier.transporterReviewCount,
          etaLabel: etaLabel(score, locale),
          score,
          isOnline: profile.isActive,
          zones: profile.areas,
          cities: profile.cities,
          activeJobsCount: activeJobs,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.id.localeCompare(b.id);
      })
      .slice(0, take);

    const isOwnerOrAdmin = Boolean(
      session?.user?.id &&
        (session.user.id === job.customerId || session.user.role === "ADMIN")
    );

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        pickupArea,
      },
      couriers: scored.map((entry) => ({
        id: entry.id,
        name: entry.name,
        image: entry.image,
        ratingAvg: entry.ratingAvg,
        ratingCount: entry.ratingCount,
        etaLabel: entry.etaLabel,
        ...(isOwnerOrAdmin
          ? {
              isOnline: entry.isOnline,
              zones: entry.zones,
              cities: entry.cities,
              activeJobsCount: entry.activeJobsCount,
              score: entry.score,
            }
          : {}),
      })),
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

