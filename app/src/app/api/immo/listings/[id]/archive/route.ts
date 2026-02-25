import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse } from "@/app/api/immo/listings/_shared";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await context.params;
  const isAdmin = canAccessAdmin(session.user);
  const listing = await prisma.immoListing.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });

  if (!listing) {
    return errorResponse(404, "NOT_FOUND", "Listing not found.");
  }

  if (!isAdmin && listing.ownerId !== session.user.id) {
    return errorResponse(403, "FORBIDDEN", "You can archive only your own listing.");
  }

  const result = await prisma.immoListing.updateMany({
    where: {
      id,
      ...(isAdmin ? {} : { ownerId: session.user.id }),
      status: { in: ["DRAFT", "PUBLISHED", "PAUSED"] },
    },
    data: { status: "ARCHIVED" },
  });

  if (result.count === 0) {
    return errorResponse(409, "INVALID_LISTING_STATUS", "Listing cannot be archived from current status.");
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
