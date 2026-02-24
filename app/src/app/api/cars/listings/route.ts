import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdmin,
  errorResponse,
  normalizeSkip,
  normalizeString,
  normalizeTake,
  normalizeUpper,
  parseBoolean,
  parseNullableInt,
} from "@/app/api/cars/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

const FUEL_TYPES = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "LPG", "OTHER"] as const;
const GEARBOX_TYPES = ["MANUAL", "AUTO", "OTHER"] as const;
const SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;
const PUBLISHER_TYPES = ["INDIVIDUAL", "DEALER"] as const;

type FuelType = (typeof FUEL_TYPES)[number];
type GearboxType = (typeof GEARBOX_TYPES)[number];
type SortType = (typeof SORT_VALUES)[number];
type PublisherType = (typeof PUBLISHER_TYPES)[number];

function parseFuelType(value: unknown): FuelType | null {
  const normalized = normalizeUpper(value);
  return FUEL_TYPES.includes(normalized as FuelType) ? (normalized as FuelType) : null;
}

function parseGearbox(value: unknown): GearboxType | null {
  const normalized = normalizeUpper(value);
  return GEARBOX_TYPES.includes(normalized as GearboxType) ? (normalized as GearboxType) : null;
}

function parseSort(value: unknown): SortType {
  const normalized = normalizeString(value).toLowerCase();
  return SORT_VALUES.includes(normalized as SortType) ? (normalized as SortType) : "newest";
}

function parsePublisherType(value: unknown): PublisherType | null {
  const normalized = normalizeUpper(value);
  return PUBLISHER_TYPES.includes(normalized as PublisherType) ? (normalized as PublisherType) : null;
}

async function resolvePublisherMembership(publisherId: string, userId: string, isAdmin: boolean) {
  const publisher = await prisma.carPublisher.findUnique({
    where: { id: publisherId },
    select: { id: true, type: true, status: true },
  });

  if (!publisher || publisher.type !== "DEALER" || publisher.status !== "ACTIVE") {
    return { error: "PUBLISHER_NOT_FOUND", message: "Dealer publisher not found." } as const;
  }

  if (isAdmin) {
    return { publisher } as const;
  }

  const membership = await prisma.carPublisherMember.findFirst({
    where: {
      publisherId,
      userId,
      status: "ACTIVE",
      role: { in: ["OWNER", "AGENT"] },
    },
    select: { id: true },
  });

  if (!membership) {
    return { error: "FORBIDDEN", message: "You must be an active dealer member." } as const;
  }

  return { publisher } as const;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const country = normalizeUpper(searchParams.get("country"));
  const city = normalizeString(searchParams.get("city"));
  const make = normalizeString(searchParams.get("make"));
  const model = normalizeString(searchParams.get("model"));
  const yearMin = parseNullableInt(searchParams.get("yearMin"));
  const yearMax = parseNullableInt(searchParams.get("yearMax"));
  const mileageMax = parseNullableInt(searchParams.get("mileageMax"));
  const priceMin = parseNullableInt(searchParams.get("priceMin"));
  const priceMax = parseNullableInt(searchParams.get("priceMax"));
  const fuelType = parseFuelType(searchParams.get("fuelType"));
  const gearbox = parseGearbox(searchParams.get("gearbox"));
  const publisherSlug = normalizeString(searchParams.get("publisherSlug"));
  const publisherType = parsePublisherType(searchParams.get("publisherType"));
  const verifiedOnly = parseBoolean(searchParams.get("verifiedOnly"));
  const sort = parseSort(searchParams.get("sort"));
  const take = normalizeTake(searchParams.get("take"), 24, 60);
  const skip = normalizeSkip(searchParams.get("skip"));

  const where: Record<string, unknown> = {
    status: "PUBLISHED",
  };

  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (make) where.make = { contains: make, mode: "insensitive" };
  if (model) where.model = { contains: model, mode: "insensitive" };
  if (fuelType) where.fuelType = fuelType;
  if (gearbox) where.gearbox = gearbox;

  if (yearMin !== null || yearMax !== null) {
    where.year = {
      ...(yearMin !== null ? { gte: yearMin } : {}),
      ...(yearMax !== null ? { lte: yearMax } : {}),
    };
  }

  if (mileageMax !== null) {
    where.mileageKm = { lte: mileageMax };
  }

  if (priceMin !== null || priceMax !== null) {
    where.priceCents = {
      ...(priceMin !== null ? { gte: priceMin } : {}),
      ...(priceMax !== null ? { lte: priceMax } : {}),
    };
  }

  if (publisherType === "DEALER") {
    where.publisherId = { not: null };
  } else if (publisherType === "INDIVIDUAL") {
    where.publisherId = null;
  }

  if (publisherSlug) {
    where.publisher = {
      is: {
        slug: publisherSlug,
        type: "DEALER",
        status: "ACTIVE",
      },
    };
  }

  if (verifiedOnly === true && publisherType !== "INDIVIDUAL") {
    where.publisher = {
      is: {
        ...(publisherSlug ? { slug: publisherSlug } : {}),
        type: "DEALER",
        status: "ACTIVE",
        verified: true,
      },
    };
    where.publisherId = { not: null };
  }

  const orderBy =
    sort === "price_asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price_desc"
      ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const listings = await prisma.carListing.findMany({
    where,
    orderBy,
    take,
    skip,
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      currency: true,
      country: true,
      city: true,
      make: true,
      model: true,
      year: true,
      mileageKm: true,
      fuelType: true,
      gearbox: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publisherId: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
          logoUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ listings });
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return withCorrelationId(
      errorResponse(401, "UNAUTHORIZED", "Authentication required."),
      correlationId
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return withCorrelationId(
      errorResponse(400, "INVALID_BODY", "Invalid JSON body."),
      correlationId
    );
  }

  const title = normalizeString((body as { title?: unknown }).title);
  const description = normalizeString((body as { description?: unknown }).description);
  const priceCents = parseNullableInt((body as { priceCents?: unknown }).priceCents);
  const currency = normalizeUpper((body as { currency?: unknown }).currency) || "XOF";
  const country = normalizeUpper((body as { country?: unknown }).country) || "SN";
  const city = normalizeString((body as { city?: unknown }).city);
  const make = normalizeString((body as { make?: unknown }).make);
  const model = normalizeString((body as { model?: unknown }).model);
  const year = parseNullableInt((body as { year?: unknown }).year);
  const mileageKm = parseNullableInt((body as { mileageKm?: unknown }).mileageKm);
  const fuelType = parseFuelType((body as { fuelType?: unknown }).fuelType);
  const gearbox = parseGearbox((body as { gearbox?: unknown }).gearbox);
  const publisherIdRaw = (body as { publisherId?: unknown }).publisherId;
  const publisherId = typeof publisherIdRaw === "string" ? publisherIdRaw.trim() : "";

  if (!title || !description || !city || !make || !model || priceCents === null || year === null || mileageKm === null || !fuelType || !gearbox) {
    return withCorrelationId(
      errorResponse(
        400,
        "VALIDATION_ERROR",
        "title, description, priceCents, city, make, model, year, mileageKm, fuelType and gearbox are required."
      ),
      correlationId
    );
  }

  if (year < 1950 || year > 2100) {
    return withCorrelationId(
      errorResponse(400, "VALIDATION_ERROR", "year must be between 1950 and 2100."),
      correlationId
    );
  }

  const isAdmin = canAccessAdmin(session.user);
  let publisherForCreateId: string | null = null;

  if (publisherId) {
    const access = await resolvePublisherMembership(publisherId, session.user.id, isAdmin);
    if ("error" in access) {
      const errorCode = access.error ?? "FORBIDDEN";
      const message = access.message ?? "Forbidden.";
      return withCorrelationId(
        errorResponse(errorCode === "FORBIDDEN" ? 403 : 404, errorCode, message),
        correlationId
      );
    }
    publisherForCreateId = access.publisher.id;
  }

  const created = await prisma.carListing.create({
    data: {
      ownerId: session.user.id,
      publisherId: publisherForCreateId,
      status: "DRAFT",
      title,
      description,
      priceCents,
      currency,
      country,
      city,
      make,
      model,
      year,
      mileageKm,
      fuelType,
      gearbox,
    },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      currency: true,
      country: true,
      city: true,
      make: true,
      model: true,
      year: true,
      mileageKm: true,
      fuelType: true,
      gearbox: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      publisherId: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
          logoUrl: true,
        },
      },
    },
  });

  auditLog({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "cars.listingCreate",
    entity: { type: "car_listing", id: created.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: {
      isAdmin,
      status: created.status,
      priceCents: created.priceCents,
      currency: created.currency,
      publisherId: created.publisherId,
    },
  });

  return withCorrelationId(NextResponse.json({ listing: created }, { status: 201 }), correlationId);
}
