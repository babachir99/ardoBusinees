import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeZone(value: unknown) {
  return String(value ?? "").trim();
}

function validateZones(value: unknown) {
  if (value === undefined) {
    return { ok: true as const, zones: undefined as string[] | undefined };
  }

  if (!Array.isArray(value)) {
    return { ok: false as const, error: "INVALID_ZONES", message: "zones must be an array of strings." };
  }

  const cleaned = value
    .map((entry) => normalizeZone(entry))
    .filter((entry) => entry.length > 0);

  const unique = Array.from(new Set(cleaned));

  if (unique.length > 10) {
    return { ok: false as const, error: "INVALID_ZONES", message: "zones supports maximum 10 values." };
  }

  const invalid = unique.find((entry) => entry.length < 2 || entry.length > 30);
  if (invalid) {
    return {
      ok: false as const,
      error: "INVALID_ZONES",
      message: "each zone must be between 2 and 30 characters.",
    };
  }

  return { ok: true as const, zones: unique };
}

export async function GET(_request: NextRequest) {
  const runtimePrisma = prisma as unknown as { tiakCourierProfile?: unknown };
  if (!runtimePrisma.tiakCourierProfile) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (session.user.role !== "COURIER") {
    return errorResponse(403, "FORBIDDEN", "Courier role required.");
  }

  try {
    const profile = await prisma.tiakCourierProfile.findUnique({
      where: { courierId: session.user.id },
      select: {
        isActive: true,
        areas: true,
      },
    });

    return NextResponse.json({
      profile: {
        isOnline: profile?.isActive ?? false,
        zones: profile?.areas ?? [],
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

export async function PATCH(request: NextRequest) {
  const runtimePrisma = prisma as unknown as { tiakCourierProfile?: unknown };
  if (!runtimePrisma.tiakCourierProfile) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (session.user.role !== "COURIER") {
    return errorResponse(403, "FORBIDDEN", "Courier role required.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const parsedZones = validateZones((body as { zones?: unknown }).zones);
  if (!parsedZones.ok) {
    return errorResponse(400, parsedZones.error, parsedZones.message);
  }

  const requestedOnline = (body as { isOnline?: unknown }).isOnline;
  if (requestedOnline !== undefined && typeof requestedOnline !== "boolean") {
    return errorResponse(400, "INVALID_IS_ONLINE", "isOnline must be boolean.");
  }

  try {
    const current = await prisma.tiakCourierProfile.findUnique({
      where: { courierId: session.user.id },
      select: {
        isActive: true,
        areas: true,
        cities: true,
      },
    });

    const nextIsOnline = typeof requestedOnline === "boolean" ? requestedOnline : (current?.isActive ?? false);
    const nextZones = parsedZones.zones ?? (current?.areas ?? []);

    await prisma.tiakCourierProfile.upsert({
      where: { courierId: session.user.id },
      create: {
        courierId: session.user.id,
        isActive: nextIsOnline,
        areas: nextZones,
        cities: nextZones,
      },
      update: {
        isActive: nextIsOnline,
        areas: nextZones,
      },
    });

    return NextResponse.json({
      profile: {
        isOnline: nextIsOnline,
        zones: nextZones,
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

