import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, canPublishImmo, errorResponse } from "@/app/api/immo/listings/_shared";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (!canPublishImmo(session.user)) {
    return errorResponse(403, "FORBIDDEN", "Publishing requires SELLER or IMMO_AGENT role.");
  }

  const { id } = await context.params;
  const isAdmin = canAccessAdmin(session.user);
  const listing = await prisma.immoListing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      status: true,
      imageUrls: true,
      publisherId: true,
      publisher: {
        select: {
          id: true,
          type: true,
          status: true,
          includedPublishedQuota: true,
          extraSlots: true,
        },
      },
    },
  });

  if (!listing) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  if (!isAdmin && listing.ownerId != session.user.id) {
    return errorResponse(403, "FORBIDDEN", "You can publish only your own listing.");
  }

  if (!Array.isArray(listing.imageUrls) || listing.imageUrls.length === 0) {
    return errorResponse(409, "AT_LEAST_ONE_IMAGE_REQUIRED", "At least one listing image is required before publishing.");
  }


  if (listing.publisherId && listing.publisher && listing.publisher.type === "AGENCY" && listing.publisher.status === "ACTIVE") {
    const publishedCount = await prisma.immoListing.count({
      where: {
        publisherId: listing.publisherId,
        status: "PUBLISHED",
      },
    });

    const allowedQuota = listing.publisher.includedPublishedQuota + listing.publisher.extraSlots;
    if (publishedCount >= allowedQuota) {
      return errorResponse(
        409,
        "QUOTA_EXCEEDED",
        "Agency published quota exceeded. Buy EXTRA_SLOTS_10 to publish more listings."
      );
    }
  }

  const result = await prisma.immoListing.updateMany({
    where: {
      id,
      ...(isAdmin ? {} : { ownerId: session.user.id }),
      status: { in: ["DRAFT", "PAUSED"] },
    },
    data: { status: "PUBLISHED" },
  });

  if (result.count === 0) {
    return errorResponse(409, "INVALID_LISTING_STATUS", "Listing cannot be published from current status.");
  }

  const updated = await prisma.immoListing.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ listing: updated });
}
