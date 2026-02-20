import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/app/api/immo/listings/_shared";

const LISTING_TYPES = ["SALE", "RENT"] as const;
const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
const SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;
const PUBLISHER_TYPES = ["INDIVIDUAL", "AGENCY"] as const;

type ListingType = (typeof LISTING_TYPES)[number];
type PropertyType = (typeof PROPERTY_TYPES)[number];
type SortValue = (typeof SORT_VALUES)[number];
type PublisherType = (typeof PUBLISHER_TYPES)[number];

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

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

function parseSort(value: unknown): SortValue {
  const normalized = normalizeString(value).toLowerCase();
  return SORT_VALUES.includes(normalized as SortValue)
    ? (normalized as SortValue)
    : "newest";
}

function parsePublisherType(value: unknown): PublisherType | null {
  const normalized = normalizeString(value).toUpperCase();
  return PUBLISHER_TYPES.includes(normalized as PublisherType)
    ? (normalized as PublisherType)
    : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const listingType = parseListingType(searchParams.get("listingType"));
  const propertyType = parsePropertyType(searchParams.get("propertyType"));
  const minPrice = parseNullableInt(searchParams.get("minPrice"));
  const maxPrice = parseNullableInt(searchParams.get("maxPrice"));
  const minSurface = parseNullableInt(searchParams.get("minSurface"));
  const maxSurface = parseNullableInt(searchParams.get("maxSurface"));
  const country = normalizeString(searchParams.get("country")).toUpperCase();
  const city = normalizeString(searchParams.get("city"));
  const publisherSlug = normalizeString(searchParams.get("publisherSlug"));
  const publisherType = parsePublisherType(searchParams.get("publisherType"));
  const verifiedOnly = parseBoolean(searchParams.get("verifiedOnly"));
  const proRankingRaw = parseBoolean(searchParams.get("proRanking"));
  const proRanking = proRankingRaw !== false;
  const takeRaw = Number(searchParams.get("take") ?? "24");
  const skipRaw = Number(searchParams.get("skip") ?? "0");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 60) : 24;
  const skip = Number.isFinite(skipRaw) ? Math.max(Math.trunc(skipRaw), 0) : 0;
  const sort = parseSort(searchParams.get("sort"));
  const now = new Date();

  const where: Record<string, unknown> = {
    status: "PUBLISHED",
  };

  if (listingType) where.listingType = listingType;
  if (propertyType) where.propertyType = propertyType;
  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };

  if (publisherType === "AGENCY") {
    where.publisherId = { not: null };
  } else if (publisherType === "INDIVIDUAL") {
    where.publisherId = null;
  }

  if (publisherSlug) {
    where.publisher = {
      is: {
        slug: publisherSlug,
        type: "AGENCY",
        status: "ACTIVE",
      },
    };
  }

  if (verifiedOnly === true) {
    if (publisherType === "AGENCY" || publisherSlug) {
      where.publisher = {
        is: {
          ...(publisherSlug ? { slug: publisherSlug } : {}),
          type: "AGENCY",
          status: "ACTIVE",
          verified: true,
        },
      };
    } else if (publisherType !== "INDIVIDUAL") {
      where.OR = [
        { publisherId: null },
        {
          publisher: {
            is: {
              type: "AGENCY",
              status: "ACTIVE",
              verified: true,
            },
          },
        },
      ];
    }
  }

  if (minPrice !== null || maxPrice !== null) {
    where.priceCents = {
      ...(minPrice !== null ? { gte: minPrice } : {}),
      ...(maxPrice !== null ? { lte: maxPrice } : {}),
    };
  }

  if (minSurface !== null || maxSurface !== null) {
    where.surfaceM2 = {
      ...(minSurface !== null ? { gte: minSurface } : {}),
      ...(maxSurface !== null ? { lte: maxSurface } : {}),
    };
  }

  const orderBy =
    sort === "price_asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price_desc"
      ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
      : proRanking
      ? [
          { isFeatured: "desc" as const },
          { featuredUntil: "desc" as const },
          { boostUntil: "desc" as const },
          { createdAt: "desc" as const },
        ]
      : [{ createdAt: "desc" as const }];

  if (proRanking) {
    await prisma.immoListing.updateMany({
      where: {
        status: "PUBLISHED",
        isFeatured: true,
        featuredUntil: { lt: now },
      },
      data: { isFeatured: false },
    }).catch(() => null);
  }

  const listings = await prisma.immoListing.findMany({
    where,
    orderBy,
    take,
    skip,
    select: {
      id: true,
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
      status: true,
      contactMode: true,
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

  return NextResponse.json({ listings });
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

  const title = normalizeString((body as { title?: unknown }).title);
  const description = normalizeString((body as { description?: unknown }).description);
  const listingType = parseListingType((body as { listingType?: unknown }).listingType);
  const propertyType = parsePropertyType((body as { propertyType?: unknown }).propertyType);
  const priceCents = parseNullableInt((body as { priceCents?: unknown }).priceCents);
  const currency = normalizeString((body as { currency?: unknown }).currency).toUpperCase() || "EUR";
  const surfaceM2 = parseNullableInt((body as { surfaceM2?: unknown }).surfaceM2);
  const rooms = parseNullableInt((body as { rooms?: unknown }).rooms);
  const city = normalizeString((body as { city?: unknown }).city);
  const country = normalizeString((body as { country?: unknown }).country).toUpperCase() || "SN";
  const publisherIdRaw = (body as { publisherId?: unknown }).publisherId;
  const publisherId = typeof publisherIdRaw === "string" ? publisherIdRaw.trim() : "";

  if (!title || !description || !listingType || !propertyType || priceCents === null || surfaceM2 === null || !city) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "title, description, listingType, propertyType, priceCents, surfaceM2 and city are required."
    );
  }

  let publisherForCreateId: string | null = null;

  if (publisherId) {
    const publisher = await prisma.immoPublisher.findUnique({
      where: { id: publisherId },
      select: { id: true, type: true, status: true },
    });

    if (!publisher || publisher.type !== "AGENCY" || publisher.status !== "ACTIVE") {
      return errorResponse(404, "PUBLISHER_NOT_FOUND", "Agency publisher not found.");
    }

    const isAdmin = canAccessAdmin(session.user);
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
      return errorResponse(403, "FORBIDDEN", "You must be an active agency member.");
    }

    publisherForCreateId = publisher.id;
  }

  const created = await prisma.immoListing.create({
    data: {
      ownerId: session.user.id,
      publisherId: publisherForCreateId,
      title,
      description,
      listingType,
      propertyType,
      priceCents,
      currency,
      surfaceM2,
      rooms,
      city,
      country,
      addressHidden: true,
      contactMode: "INTERNAL_MESSAGE",
      status: "DRAFT",
    },
    select: {
      id: true,
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
      status: true,
      contactMode: true,
      isFeatured: true,
      featuredUntil: true,
      boostUntil: true,
      monetizationUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      publisherId: true,
    },
  });

  return NextResponse.json({ listing: created }, { status: 201 });
}
