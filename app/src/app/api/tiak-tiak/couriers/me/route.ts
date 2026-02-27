import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { KycRole, KycStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { hasAnyUserRole, hasUserRole } from "@/lib/userRoles";

const vertical = Vertical.TIAK_TIAK;
const rules = getVerticalRules(vertical);

function hasTiakCourierProfileDelegate() {
  const runtimePrisma = prisma as unknown as { tiakCourierProfile?: unknown };
  return Boolean(runtimePrisma.tiakCourierProfile);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : null;
}

function parseStringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const cleaned = value
    .map((entry) => normalizeString(entry))
    .filter((entry) => entry.length > 0)
    .slice(0, 50);
  return Array.from(new Set(cleaned));
}

async function resolveProfile(userId: string) {
  return prisma.tiakCourierProfile.findUnique({
    where: { courierId: userId },
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
}

export async function GET(_request: NextRequest) {
  if (!hasTiakCourierProfileDelegate()) {
    return NextResponse.json(
      { error: "Tiak courier profile delegate unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAnyUserRole(session.user, ["COURIER", "TIAK_COURIER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await resolveProfile(session.user.id);
  return NextResponse.json(profile);
}

export async function POST(request: NextRequest) {
  if (!hasTiakCourierProfileDelegate()) {
    return NextResponse.json(
      { error: "Tiak courier profile delegate unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAnyUserRole(session.user, ["COURIER", "TIAK_COURIER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (rules.kycRequiredForPublishing && !hasUserRole(session.user, "ADMIN")) {
    const approvedKyc = await prisma.kycSubmission.findFirst({
      where: {
        userId: session.user.id,
        targetRole: { in: [KycRole.COURIER, KycRole.TIAK_COURIER] },
        status: KycStatus.APPROVED,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (!approvedKyc) {
      return NextResponse.json(
        { error: "KYC approval is required to publish a courier profile." },
        { status: 403 }
      );
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const isActive = typeof (body as { isActive?: unknown }).isActive === "boolean"
    ? Boolean((body as { isActive?: boolean }).isActive)
    : true;

  await prisma.tiakCourierProfile.upsert({
    where: { courierId: session.user.id },
    create: {
      courierId: session.user.id,
      isActive,
      cities: parseStringList((body as { cities?: unknown }).cities),
      areas: parseStringList((body as { areas?: unknown }).areas),
      vehicleType: normalizeString((body as { vehicleType?: unknown }).vehicleType) || null,
      maxWeightKg: parseNullableInt((body as { maxWeightKg?: unknown }).maxWeightKg),
      availableHours: normalizeString((body as { availableHours?: unknown }).availableHours) || null,
    },
    update: {
      isActive,
      cities: parseStringList((body as { cities?: unknown }).cities),
      areas: parseStringList((body as { areas?: unknown }).areas),
      vehicleType: normalizeString((body as { vehicleType?: unknown }).vehicleType) || null,
      maxWeightKg: parseNullableInt((body as { maxWeightKg?: unknown }).maxWeightKg),
      availableHours: normalizeString((body as { availableHours?: unknown }).availableHours) || null,
    },
  });

  const profile = await resolveProfile(session.user.id);
  return NextResponse.json(profile, { status: 201 });
}

export const PATCH = POST;

