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
import { assertSameOrigin } from "@/lib/request-security";

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
      publisherId: true,
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
      isFeatured: true,
      featuredUntil: true,
      boostUntil: true,
      createdAt: true,
      updatedAt: true,
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
}

type LoadedAutoListing = Awaited<ReturnType<typeof loadListing>>;

function sanitizePublicListing(listing: LoadedAutoListing) {
  if (!listing) return null;
  const { ownerId, ...safeListing } = listing;
  void ownerId;
  return safeListing;
}

async function resolvePublisherMembership(publisherId: string, userId: string, isAdmin: boolean) {
  const publisher = await prisma.autoPublisher.findUnique({
    where: { id: publisherId },
    select: { id: true, type: true, status: true },
  });

  if (!publisher || publisher.type !== "DEALER" || publisher.status !== "ACTIVE") {
    return { error: "PUBLISHER_NOT_FOUND", message: "Dealer publisher not found." } as const;
  }

  if (isAdmin) {
    return { publisher } as const;
  }

  const membership = await prisma.autoPublisherMember.findFirst({
    where: {
      publisherId,
      userId,
      status: "ACTIVE",
      role: { in: ["OWNER", "AGENT"] },
    },
    select: { id: true, role: true },
  });

  if (!membership) {
    return { error: "FORBIDDEN", message: "You must be an active dealer member." } as const;
  }

  return { publisher, membership } as const;
}

export async function GET(
  request: NextRequest,
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

  return NextResponse.json({ listing: sanitizePublicListing(listing) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

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

  const publisherIdRaw = (body as { publisherId?: unknown }).publisherId;
  const publisherId = typeof publisherIdRaw === "string" ? publisherIdRaw.trim() : null;
  const wantsPublisherAttach = typeof publisherIdRaw === "string";
  const wantsPublisherDetach = publisherIdRaw === null;

  const hasFieldChanges = Object.keys(data).length > 0;
  const wantsPublisherChange = wantsPublisherAttach || wantsPublisherDetach;

  if (hasFieldChanges && !["DRAFT", "PAUSED"].includes(listing.status)) {
    return withCorrelationId(
      errorResponse(409, "INVALID_LISTING_STATUS", "Only DRAFT or PAUSED listings can be edited."),
      correlationId
    );
  }

  if (wantsPublisherChange && !["DRAFT", "PAUSED"].includes(listing.status)) {
    return withCorrelationId(
      errorResponse(409, "INVALID_LISTING_STATUS", "Publisher can be changed only for DRAFT or PAUSED listings."),
      correlationId
    );
  }

  if (!isOwner && !isAdmin && (!wantsPublisherAttach || hasFieldChanges)) {
    return withCorrelationId(
      errorResponse(403, "FORBIDDEN", "You can edit only your own listing."),
      correlationId
    );
  }

  if (wantsPublisherDetach) {
    if (!isOwner && !isAdmin) {
      return withCorrelationId(
        errorResponse(403, "FORBIDDEN", "Only owner or admin can detach publisher."),
        correlationId
      );
    }
    data.publisherId = null;
  }

  if (wantsPublisherAttach) {
    if (!publisherId) {
      return withCorrelationId(
        errorResponse(400, "INVALID_PUBLISHER", "publisherId is invalid."),
        correlationId
      );
    }

    const access = await resolvePublisherMembership(publisherId, session.user.id, isAdmin);
    if ("error" in access) {
      const errorCode = access.error ?? "FORBIDDEN";
      const message = access.message ?? "Forbidden.";
      return withCorrelationId(
        errorResponse(errorCode === "FORBIDDEN" ? 403 : 404, errorCode, message),
        correlationId
      );
    }

    data.publisherId = access.publisher.id;

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "auto.listingAttachPublisher",
      entity: { type: "auto_listing", id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { publisherId: access.publisher.id },
    });
  }

  if (statusRequested === "PAUSED") {
    data.status = "PAUSED";
  }

  if (statusRequested === "ARCHIVED") {
    data.status = "ARCHIVED";
  }

  if (!statusRequested && Object.keys(data).length === 0) {
    return withCorrelationId(errorResponse(400, "NO_CHANGES", "No valid changes provided."), correlationId);
  }

  const canAttachAsMember = !isAdmin && !isOwner && wantsPublisherAttach && !hasFieldChanges && !statusRequested;
  const requiresDraftPausedState = hasFieldChanges || wantsPublisherChange;

  const where: Record<string, unknown> = {
    id,
    ...(isAdmin || canAttachAsMember ? {} : { ownerId: session.user.id }),
  };

  if (requiresDraftPausedState) {
    where.status = { in: ["DRAFT", "PAUSED"] };
  } else if (statusRequested === "PAUSED") {
    where.status = "PUBLISHED";
  } else if (statusRequested === "ARCHIVED") {
    where.status = { in: ["DRAFT", "PUBLISHED", "PAUSED"] };
  }

  const result = await prisma.autoListing.updateMany({ where, data });

  if (result.count === 0) {
    return withCorrelationId(
      errorResponse(409, "INVALID_LISTING_STATUS", "Listing cannot transition from current status."),
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
      publisherId: updated?.publisherId ?? null,
    },
  });

  return withCorrelationId(NextResponse.json({ listing: sanitizePublicListing(updated) }), correlationId);
}
