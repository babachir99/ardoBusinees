import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreCouriersForDelivery, toArea } from "@/lib/tiak/matching";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function etaLabel(score: number, locale: string) {
  if (score >= 75) return locale === "fr" ? "~15-25 min" : "~15-25 min";
  if (score >= 55) return locale === "fr" ? "~25-40 min" : "~25-40 min";
  return locale === "fr" ? "~40-60 min" : "~40-60 min";
}

export async function GET(request: NextRequest) {
  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: unknown;
    tiakCourierProfile?: unknown;
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
    const job = await prisma.tiakDelivery.findUnique({
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

    const scored = await scoreCouriersForDelivery(job.id, take);

    const isOwnerOrAdmin = Boolean(
      session?.user?.id &&
        (session.user.id === job.customerId || session.user.role === "ADMIN")
    );

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        pickupArea: toArea(job.pickupAddress),
      },
      couriers: scored.map((entry) => ({
        id: entry.courierId,
        name: entry.name,
        image: entry.image,
        ratingAvg: entry.ratingAvg,
        ratingCount: entry.ratingCount,
        etaLabel: etaLabel(entry.score, locale),
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

