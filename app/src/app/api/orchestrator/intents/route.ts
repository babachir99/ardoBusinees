import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SOURCE_VERTICALS = ["CARS", "SHOP", "IMMO", "PRESTA"] as const;
const INTENT_TYPES = ["TRANSPORT", "LOCAL_DELIVERY", "SERVICE_REQUEST"] as const;
const OBJECT_TYPES = ["DOCUMENTS", "SMALL_PARCEL", "PARTS", "KEYS", "NONE"] as const;

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCountry(value: unknown) {
  return normalizeString(value).toUpperCase() || null;
}

function normalizeCity(value: unknown) {
  const v = normalizeString(value);
  return v || null;
}

function parseWeightKg(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function serializeIntent(intent: {
  id: string;
  sourceVertical: string;
  sourceEntityId: string;
  intentType: string;
  objectType: string;
  weightKg: number | null;
  fromCountry: string | null;
  toCountry: string | null;
  fromCity: string | null;
  toCity: string | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
}) {
  return {
    ...intent,
    createdAt: intent.createdAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const sourceVertical = normalizeString((body as { sourceVertical?: unknown }).sourceVertical).toUpperCase();
  const sourceEntityId = normalizeString((body as { sourceEntityId?: unknown }).sourceEntityId);
  const intentType = normalizeString((body as { intentType?: unknown }).intentType).toUpperCase();
  const objectTypeRaw = normalizeString((body as { objectType?: unknown }).objectType).toUpperCase();
  const objectType = objectTypeRaw || "NONE";
  const weightKg = parseWeightKg((body as { weightKg?: unknown }).weightKg);
  const fromCountry = normalizeCountry((body as { fromCountry?: unknown }).fromCountry);
  const toCountry = normalizeCountry((body as { toCountry?: unknown }).toCountry);
  const fromCity = normalizeCity((body as { fromCity?: unknown }).fromCity);
  const toCity = normalizeCity((body as { toCity?: unknown }).toCity);

  if (!SOURCE_VERTICALS.includes(sourceVertical as (typeof SOURCE_VERTICALS)[number])) {
    return errorResponse(400, "VALIDATION_ERROR", "sourceVertical must be one of CARS, SHOP, IMMO, PRESTA.");
  }
  if (!sourceEntityId) {
    return errorResponse(400, "VALIDATION_ERROR", "sourceEntityId is required.");
  }
  if (!INTENT_TYPES.includes(intentType as (typeof INTENT_TYPES)[number])) {
    return errorResponse(400, "VALIDATION_ERROR", "intentType must be one of TRANSPORT, LOCAL_DELIVERY, SERVICE_REQUEST.");
  }
  if (!OBJECT_TYPES.includes(objectType as (typeof OBJECT_TYPES)[number])) {
    return errorResponse(400, "VALIDATION_ERROR", "objectType is invalid.");
  }
  if ((body as { weightKg?: unknown }).weightKg !== undefined && (body as { weightKg?: unknown }).weightKg !== null && weightKg === null) {
    return errorResponse(400, "VALIDATION_ERROR", "weightKg must be a non-negative number.");
  }

  const created = await prisma.crossVerticalIntent.create({
    data: {
      sourceVertical: sourceVertical as "CARS" | "SHOP" | "IMMO" | "PRESTA",
      sourceEntityId,
      intentType: intentType as "TRANSPORT" | "LOCAL_DELIVERY" | "SERVICE_REQUEST",
      objectType: objectType as "DOCUMENTS" | "SMALL_PARCEL" | "PARTS" | "KEYS" | "NONE",
      weightKg,
      fromCountry,
      toCountry,
      fromCity,
      toCity,
      status: "OPEN",
      createdByUserId: session.user.id,
    },
    select: {
      id: true,
      sourceVertical: true,
      sourceEntityId: true,
      intentType: true,
      objectType: true,
      weightKg: true,
      fromCountry: true,
      toCountry: true,
      fromCity: true,
      toCity: true,
      status: true,
      createdByUserId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ intentId: created.id, intent: serializeIntent(created) }, { status: 201 });
}
