import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, normalizeString, normalizeTake } from "@/app/api/cars/listings/_shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

function isIdLikePublisherKey(value: string) {
  return UUID_PATTERN.test(value) || CUID_PATTERN.test(value);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publisherKey: string }> }
) {
  const { searchParams } = new URL(request.url);
  const take = normalizeTake(searchParams.get("take"), 12, 30);
  const { publisherKey } = await context.params;
  const normalizedKey = normalizeString(publisherKey);

  if (!normalizedKey) {
    return errorResponse(404, "NOT_FOUND", "Dealer not found.");
  }

  const publisherWhere = {
    type: "DEALER" as const,
    status: "ACTIVE" as const,
  };

  const publisher = await prisma.carPublisher.findFirst({
    where: isIdLikePublisherKey(normalizedKey)
      ? {
          ...publisherWhere,
          id: normalizedKey,
        }
      : {
          ...publisherWhere,
          slug: normalizedKey,
        },
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      country: true,
      city: true,
      logoUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          listings: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
  });

  if (!publisher) {
    return errorResponse(404, "NOT_FOUND", "Dealer not found.");
  }

  const listings = await prisma.carListing.findMany({
    where: {
      publisherId: publisher.id,
      status: "PUBLISHED",
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      priceCents: true,
      currency: true,
      city: true,
      country: true,
      make: true,
      model: true,
      year: true,
      mileageKm: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    publisher: {
      id: publisher.id,
      name: publisher.name,
      slug: publisher.slug,
      verified: publisher.verified,
      country: publisher.country,
      city: publisher.city,
      logoUrl: publisher.logoUrl,
      createdAt: publisher.createdAt,
      updatedAt: publisher.updatedAt,
    },
    meta: {
      publishedListingsCount: publisher._count.listings,
    },
    listings,
  });
}