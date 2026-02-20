import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdmin,
  canPublishAuto,
  errorResponse,
} from "@/app/api/auto/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

export async function POST(
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

  if (!canPublishAuto(session.user)) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "auto.listingPublish",
      entity: { type: "auto_listing" },
      outcome: "DENIED",
      reason: AuditReason.FORBIDDEN,
      metadata: { reason: "ROLE_REQUIRED" },
    });

    return withCorrelationId(
      errorResponse(403, "FORBIDDEN", "Publishing requires SELLER or ADMIN role."),
      correlationId
    );
  }

  const { id } = await context.params;
  const isAdmin = canAccessAdmin(session.user);
  const listing = await prisma.autoListing.findUnique({
    where: { id },
    select: { id: true, ownerId: true, status: true },
  });

  if (!listing) {
    return withCorrelationId(errorResponse(404, "NOT_FOUND", "Listing not found."), correlationId);
  }

  if (!isAdmin && listing.ownerId !== session.user.id) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "auto.listingPublish",
      entity: { type: "auto_listing", id },
      outcome: "DENIED",
      reason: AuditReason.FORBIDDEN,
      metadata: { ownerId: listing.ownerId },
    });

    return withCorrelationId(
      errorResponse(403, "FORBIDDEN", "You can publish only your own listing."),
      correlationId
    );
  }

  const result = await prisma.autoListing.updateMany({
    where: {
      id,
      ...(isAdmin ? {} : { ownerId: session.user.id }),
      status: { in: ["DRAFT", "PAUSED"] },
    },
    data: { status: "PUBLISHED" },
  });

  if (result.count === 0) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "auto.listingPublish",
      entity: { type: "auto_listing", id },
      outcome: "CONFLICT",
      reason: AuditReason.STATE_CONFLICT,
      metadata: { currentStatus: listing.status },
    });

    return withCorrelationId(
      errorResponse(409, "INVALID_LISTING_STATUS", "Listing cannot be published from current status."),
      correlationId
    );
  }

  const updated = await prisma.autoListing.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });

  auditLog({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "auto.listingPublish",
    entity: { type: "auto_listing", id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { status: updated?.status ?? null },
  });

  return withCorrelationId(NextResponse.json({ listing: updated }), correlationId);
}
