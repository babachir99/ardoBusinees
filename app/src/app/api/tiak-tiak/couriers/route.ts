import { NextRequest, NextResponse } from "next/server";
import { KycRole, KycStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function hasTiakCourierProfileDelegate() {
  const runtimePrisma = prisma as unknown as { tiakCourierProfile?: unknown };
  return Boolean(runtimePrisma.tiakCourierProfile);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(request: NextRequest) {
  if (!hasTiakCourierProfileDelegate()) {
    return NextResponse.json(
      { error: "Tiak courier profile delegate unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = normalizeString(searchParams.get("q"));
  const takeRaw = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 100) : 20;

  const where: Record<string, unknown> = {
    isActive: true,
    courier: {
      kycSubmissions: {
        some: {
          targetRole: { in: [KycRole.COURIER, KycRole.TIAK_COURIER] },
          status: KycStatus.APPROVED,
        },
      },
    },
  };

  if (q) {
    where.OR = [
      { cities: { has: q } },
      { areas: { has: q } },
      { vehicleType: { contains: q, mode: "insensitive" } },
      { courier: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const profiles = await prisma.tiakCourierProfile.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      id: true,
      courierId: true,
      isActive: true,
      cities: true,
      areas: true,
      vehicleType: true,
      maxWeightKg: true,
      availableHours: true,
      createdAt: true,
      updatedAt: true,
      courier: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json(
    profiles.map((profile) => ({
      ...profile,
      isConfirmedCourier: true,
    }))
  );
}
