import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse, normalizeString } from "@/app/api/auto/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publisherKey: string }> }
) {
  const correlationId = getCorrelationId(request);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return withCorrelationId(errorResponse(401, "UNAUTHORIZED", "Authentication required."), correlationId);
  }

  const { publisherKey } = await context.params;
  const publisher = await prisma.autoPublisher.findFirst({
    where: {
      OR: [{ id: publisherKey }, { slug: publisherKey }],
      type: "DEALER",
      status: "ACTIVE",
    },
    select: { id: true, slug: true },
  });

  if (!publisher) {
    return withCorrelationId(errorResponse(404, "NOT_FOUND", "Dealer not found."), correlationId);
  }

  const isAdmin = canAccessAdmin(session.user);

  if (!isAdmin) {
    const ownerMembership = await prisma.autoPublisherMember.findFirst({
      where: {
        publisherId: publisher.id,
        userId: session.user.id,
        status: "ACTIVE",
        role: "OWNER",
      },
      select: { id: true },
    });

    if (!ownerMembership) {
      return withCorrelationId(errorResponse(403, "FORBIDDEN", "Only owner or admin can add members."), correlationId);
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return withCorrelationId(errorResponse(400, "INVALID_BODY", "Invalid JSON body."), correlationId);
  }

  const userId = normalizeString((body as { userId?: unknown }).userId);

  if (!userId) {
    return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "userId is required."), correlationId);
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!targetUser) {
    return withCorrelationId(errorResponse(404, "NOT_FOUND", "User not found."), correlationId);
  }

  try {
    const member = await prisma.autoPublisherMember.create({
      data: {
        publisherId: publisher.id,
        userId: targetUser.id,
        role: "AGENT",
        status: "ACTIVE",
      },
      select: {
        id: true,
        publisherId: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "auto.publisherAddMember",
      entity: { type: "auto_publisher", id: publisher.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { addedUserId: targetUser.id },
    });

    return withCorrelationId(NextResponse.json({ member }, { status: 201 }), correlationId);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      return withCorrelationId(errorResponse(409, "ALREADY_MEMBER", "User is already a dealer member."), correlationId);
    }

    return withCorrelationId(errorResponse(503, "PRISMA_ERROR", "Database unavailable."), correlationId);
  }
}
