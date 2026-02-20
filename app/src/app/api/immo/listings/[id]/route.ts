import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdmin,
  errorResponse,
  normalizeString,
  parseNullableInt,
} from "@/app/api/immo/listings/_shared";
import { AuditReason, auditLog, getCorrelationId } from "@/lib/audit";

const LISTING_TYPES = ["SALE", "RENT"] as const;
const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;

type ListingType = (typeof LISTING_TYPES)[number];
type PropertyType = (typeof PROPERTY_TYPES)[number];

function parseListingType(value: unknown): ListingType | null {
  const normalized = normalizeString(value).toUpperCase();
  return LISTING_TYPES.includes(normalized as ListingType)
    ? (normalized as ListingType)
    : null;
}

function parsePropertyType(value: unknown): PropertyType | null {
  const normalized = normalizeString(value).toUpperCase();
  return PROPERTY_TYPES.includes(normalized as PropertyType)
    ? (normalized as PropertyType)
    : null;
}

function parseStatusUpdate(value: unknown) {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) return null;
  return normalized;
}

async function loadListing(id: string) {
  return prisma.immoListing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      publisherId: true,
      title: true,
      description: true,
      listingType: true,
      propertyType: true,
      priceCents: true,
      currency: true,
      surfaceM2: true,
      rooms: true,
      city: true,
      country: true,
      addressHidden: true,
      contactMode: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          type: true,
        },
      },
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          type: true,
          status: true,
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  const listing = await loadListing(id);

  if (!listing) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  const isAdmin = canAccessAdmin(session?.user);
  const isOwner = session?.user?.id === listing.ownerId;

  if (listing.status !== "PUBLISHED" && !isOwner && !isAdmin) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  return NextResponse.json({
    listing,
    contactAction: {
      mode: "INTERNAL_MESSAGE",
      available: false,
      message: "Contact via internal messaging (coming soon).",
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await context.params;
  const listing = await loadListing(id);

  if (!listing) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  const isAdmin = canAccessAdmin(session.user);
  const isOwner = listing.ownerId === session.user.id;
  const correlationId = getCorrelationId(request);

  if (!["DRAFT", "PAUSED"].includes(listing.status)) {
    return errorResponse(
      409,
      "INVALID_LISTING_STATUS",
      "Only DRAFT or PAUSED listings can be edited."
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const title = normalizeString((body as { title?: unknown }).title);
  const description = normalizeString((body as { description?: unknown }).description);
  const listingType = parseListingType((body as { listingType?: unknown }).listingType);
  const propertyType = parsePropertyType((body as { propertyType?: unknown }).propertyType);
  const priceCents = parseNullableInt((body as { priceCents?: unknown }).priceCents);
  const currency = normalizeString((body as { currency?: unknown }).currency).toUpperCase();
  const surfaceM2 = parseNullableInt((body as { surfaceM2?: unknown }).surfaceM2);
  const rooms = parseNullableInt((body as { rooms?: unknown }).rooms);
  const city = normalizeString((body as { city?: unknown }).city);
  const country = normalizeString((body as { country?: unknown }).country).toUpperCase();
  const addressHiddenRaw = (body as { addressHidden?: unknown }).addressHidden;
  const statusRaw = parseStatusUpdate((body as { status?: unknown }).status);
  const publisherIdRaw = (body as { publisherId?: unknown }).publisherId;
  const publisherId = typeof publisherIdRaw === "string" ? publisherIdRaw.trim() : null;
  const wantsPublisherDetach = publisherIdRaw === null;
  const wantsPublisherAttach = typeof publisherIdRaw === "string";

  const data: Record<string, unknown> = {};

  if (title) data.title = title;
  if (description) data.description = description;
  if (listingType) data.listingType = listingType;
  if (propertyType) data.propertyType = propertyType;
  if (priceCents !== null) data.priceCents = priceCents;
  if (currency) data.currency = currency;
  if (surfaceM2 !== null) data.surfaceM2 = surfaceM2;
  if (rooms !== null) data.rooms = rooms;
  if (city) data.city = city;
  if (country) data.country = country;
  if (typeof addressHiddenRaw === "boolean") data.addressHidden = addressHiddenRaw;
  if (statusRaw === "PAUSED" || statusRaw === "DRAFT") data.status = statusRaw;

  const hasFieldChanges = Object.keys(data).length > 0;
  const wantsPublisherChange = wantsPublisherAttach || wantsPublisherDetach;

  if (!isAdmin && !isOwner && (!wantsPublisherChange || hasFieldChanges)) {
    return errorResponse(403, "FORBIDDEN", "You can edit only your own listing.");
  }

  if (wantsPublisherDetach) {
    if (!isAdmin && !isOwner) {
      return errorResponse(403, "FORBIDDEN", "Only owner or admin can detach publisher.");
    }
    data.publisherId = null;
  }

  if (wantsPublisherAttach) {
    if (!publisherId) {
      return errorResponse(400, "INVALID_PUBLISHER", "publisherId is invalid.");
    }

    const publisher = await prisma.immoPublisher.findUnique({
      where: { id: publisherId },
      select: { id: true, type: true, status: true },
    });

    if (!publisher || publisher.type !== "AGENCY" || publisher.status !== "ACTIVE") {
      return errorResponse(404, "PUBLISHER_NOT_FOUND", "Agency publisher not found.");
    }

    const membership = isAdmin
      ? { role: "OWNER" }
      : await prisma.immoPublisherMember.findFirst({
          where: {
            publisherId,
            userId: session.user.id,
            status: "ACTIVE",
          },
          select: { role: true },
        });

    if (!membership) {
      return errorResponse(403, "FORBIDDEN", "You must be an active publisher member.");
    }

    if (!isAdmin && !isOwner && !hasFieldChanges) {
      data.publisherId = publisherId;
    } else if (isAdmin || isOwner) {
      data.publisherId = publisherId;
    } else {
      return errorResponse(403, "FORBIDDEN", "You cannot attach this listing to the publisher.");
    }

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "immo.listingAttachPublisher",
      entity: { type: "immo_listing", id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { publisherId },
    });
  }

  if (Object.keys(data).length === 0) {
    return errorResponse(400, "NO_CHANGES", "No valid fields provided.");
  }

  const updated = await prisma.immoListing.update({
    where: { id },
    data,
    select: {
      id: true,
      ownerId: true,
      publisherId: true,
      title: true,
      description: true,
      listingType: true,
      propertyType: true,
      priceCents: true,
      currency: true,
      surfaceM2: true,
      rooms: true,
      city: true,
      country: true,
      addressHidden: true,
      contactMode: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json({ listing: updated });
}
