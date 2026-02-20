import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdmin,
  errorResponse,
  normalizeString,
  normalizeUpper,
  parseNullableInt,
} from "@/app/api/auto/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

const FUEL_TYPES = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"] as const;
const GEARBOX_TYPES = ["MANUAL", "AUTO", "OTHER"] as const;

type FuelType = (typeof FUEL_TYPES)[number];
type GearboxType = (typeof GEARBOX_TYPES)[number];
type StatusAction = "PAUSED" | "ARCHIVED";

function parseFuelType(value: unknown): FuelType | null {
  const normalized = normalizeUpper(value);
  return FUEL_TYPES.includes(normalized as FuelType) ? (normalized as FuelType) : null;
}

function parseGearbox(value: unknown): GearboxType | null {
  const normalized = normalizeUpper(value);
  return GEARBOX_TYPES.includes(normalized as GearboxType) ? (normalized as GearboxType) : null;
}

function parseStatusAction(value: unknown): StatusAction | null {
  const normalized = normalizeUpper(value);
  if (normalized === "PAUSED" || normalized === "ARCHIVED") return normalized;
  return null;
}

async function loadListing(id: string) {
  return prisma.autoListing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
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
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const [session, listing] = await Promise.all([
    getServerSession(authOptions),
    loadListing(id),
  ]);

  if (!listing) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  const isAdmin = canAccessAdmin(session?.user);
  const isOwner = session?.user?.id === listing.ownerId;

  if (listing.status !== "PUBLISHED" && !isOwner && !isAdmin) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  return NextResponse.json({
    listing: {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      currency: listing.currency,
      country: listing.country,
      city: listing.city,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileageKm: listing.mileageKm,
      fuelType: listing.fuelType,
      gearbox: listing.gearbox,
      status: listing.status,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return withCorrelationId(
      errorResponse(401, "UNAUTHORIZED", "Authentication required."),
      correlationId
    );
  }

  const { id } = await context.params;
  const listing = await loadListing(id);

  if (!listing) {
    return withCorrelationId(errorResponse(404, "NOT_FOUND", "Listing not found."), correlationId);
  }

  const isAdmin = canAccessAdmin(session.user);
  const isOwner = listing.ownerId === session.user.id;

  if (!isOwner && !isAdmin) {
    return withCorrelationId(
      errorResponse(403, "FORBIDDEN", "You can edit only your own listing."),
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

  const statusRaw = (body as { status?: unknown }).status;
  const statusRequested = parseStatusAction(statusRaw);
  const normalizedStatusRaw = normalizeUpper(statusRaw);

  if (statusRaw !== undefined && !statusRequested) {
    return withCorrelationId(
      errorResponse(
        400,
        "INVALID_STATUS",
        normalizedStatusRaw === "PUBLISHED"
          ? "Use POST /api/auto/listings/{id}/publish to publish listing."
          : "status supports only PAUSED or ARCHIVED in this endpoint."
      ),
      correlationId
    );
  }

  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = normalizeString((body as { title?: unknown }).title);
    if (!title) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "title cannot be empty."), correlationId);
    }
    data.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const description = normalizeString((body as { description?: unknown }).description);
    if (!description) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "description cannot be empty."), correlationId);
    }
    data.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(body, "priceCents")) {
    const priceCents = parseNullableInt((body as { priceCents?: unknown }).priceCents);
    if (priceCents === null) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "priceCents must be an integer."), correlationId);
    }
    data.priceCents = priceCents;
  }

  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    const currency = normalizeUpper((body as { currency?: unknown }).currency);
    if (!currency) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "currency cannot be empty."), correlationId);
    }
    data.currency = currency;
  }

  if (Object.prototype.hasOwnProperty.call(body, "country")) {
    const country = normalizeUpper((body as { country?: unknown }).country);
    if (!country) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "country cannot be empty."), correlationId);
    }
    data.country = country;
  }

  if (Object.prototype.hasOwnProperty.call(body, "city")) {
    const city = normalizeString((body as { city?: unknown }).city);
    if (!city) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "city cannot be empty."), correlationId);
    }
    data.city = city;
  }

  if (Object.prototype.hasOwnProperty.call(body, "make")) {
    const make = normalizeString((body as { make?: unknown }).make);
    if (!make) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "make cannot be empty."), correlationId);
    }
    data.make = make;
  }

  if (Object.prototype.hasOwnProperty.call(body, "model")) {
    const model = normalizeString((body as { model?: unknown }).model);
    if (!model) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "model cannot be empty."), correlationId);
    }
    data.model = model;
  }

  if (Object.prototype.hasOwnProperty.call(body, "year")) {
    const year = parseNullableInt((body as { year?: unknown }).year);
    if (year === null || year < 1950 || year > 2100) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "year must be between 1950 and 2100."), correlationId);
    }
    data.year = year;
  }

  if (Object.prototype.hasOwnProperty.call(body, "mileageKm")) {
    const mileageKm = parseNullableInt((body as { mileageKm?: unknown }).mileageKm);
    if (mileageKm === null) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "mileageKm must be an integer."), correlationId);
    }
    data.mileageKm = mileageKm;
  }

  if (Object.prototype.hasOwnProperty.call(body, "fuelType")) {
    const fuelType = parseFuelType((body as { fuelType?: unknown }).fuelType);
    if (!fuelType) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "Invalid fuelType."), correlationId);
    }
    data.fuelType = fuelType;
  }

  if (Object.prototype.hasOwnProperty.call(body, "gearbox")) {
    const gearbox = parseGearbox((body as { gearbox?: unknown }).gearbox);
    if (!gearbox) {
      return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "Invalid gearbox."), correlationId);
    }
    data.gearbox = gearbox;
  }

  const hasFieldChanges = Object.keys(data).length > 0;

  if (hasFieldChanges && !["DRAFT", "PAUSED"].includes(listing.status)) {
    return withCorrelationId(
      errorResponse(409, "INVALID_LISTING_STATUS", "Only DRAFT or PAUSED listings can be edited."),
      correlationId
    );
  }

  if (!statusRequested && !hasFieldChanges) {
    return withCorrelationId(errorResponse(400, "NO_CHANGES", "No valid changes provided."), correlationId);
  }

  const where: Record<string, unknown> = {
    id,
    ...(isAdmin ? {} : { ownerId: session.user.id }),
  };

  if (statusRequested === "PAUSED") {
    where.status = "PUBLISHED";
    data.status = "PAUSED";
  }

  if (statusRequested === "ARCHIVED") {
    where.status = { in: ["DRAFT", "PUBLISHED", "PAUSED"] };
    data.status = "ARCHIVED";
  }

  const result = await prisma.autoListing.updateMany({ where, data });

  if (result.count === 0) {
    return withCorrelationId(
      errorResponse(
        409,
        "INVALID_LISTING_STATUS",
        statusRequested
          ? "Listing cannot transition from current status."
          : "Listing could not be updated from current status."
      ),
      correlationId
    );
  }

  const updated = await loadListing(id);

  auditLog({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: statusRequested ? "auto.listingStatusChange" : "auto.listingUpdate",
    entity: { type: "auto_listing", id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: {
      statusRequested,
      changedFields: Object.keys(data),
    },
  });

  return withCorrelationId(NextResponse.json({ listing: updated }), correlationId);
}
