import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/app/api/immo/listings/_shared";

function parseTake(value: unknown, fallback = 12, max = 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publisherKey: string }> }
) {
  const { publisherKey } = await context.params;
  const key = publisherKey.trim();

  if (!key) {
    return errorResponse(400, "INVALID_PUBLISHER", "Publisher slug is required.");
  }

  const publisher = await prisma.immoPublisher.findFirst({
    where: {
      slug: key,
      type: "AGENCY",
      status: "ACTIVE",
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
    },
  });

  if (!publisher) {
    return errorResponse(404, "NOT_FOUND", "Publisher not found.");
  }

  const { searchParams } = new URL(request.url);
  const take = parseTake(searchParams.get("take"), 12, 30);

  const [publishedCount, listings] = await Promise.all([
    prisma.immoListing.count({
      where: {
        publisherId: publisher.id,
        status: "PUBLISHED",
      },
    }),
    prisma.immoListing.findMany({
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
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    publisher: {
      ...publisher,
      publishedListingsCount: publishedCount,
    },
    listings,
  });
}
