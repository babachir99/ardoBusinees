import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse, normalizeString } from "@/app/api/immo/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/request-security";

function parseMemberRole(value: unknown): "OWNER" | "AGENT" {
  const normalized = normalizeString(value).toUpperCase();
  return normalized === "OWNER" ? "OWNER" : "AGENT";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publisherKey: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor: { userId: null, role: null },
      action: "immo.publisherAddMember",
      entity: { type: "immo_publisher_member" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }

  const { publisherKey } = await context.params;
  const publisherId = publisherKey.trim();
  if (!publisherId) {
    return respond(errorResponse(400, "INVALID_PUBLISHER", "Publisher id is required."));
  }

  const publisher = await prisma.immoPublisher.findUnique({
    where: { id: publisherId },
    select: { id: true, type: true, status: true },
  });

  if (!publisher || publisher.type !== "AGENCY") {
    return respond(errorResponse(404, "NOT_FOUND", "Publisher not found."));
  }

  const isAdmin = canAccessAdmin(session.user);

  if (!isAdmin) {
    const ownerMember = await prisma.immoPublisherMember.findFirst({
      where: {
        publisherId,
        userId: session.user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!ownerMember) {
      auditLog({
        correlationId,
        actor: { userId: session.user.id, role: session.user.role ?? null },
        action: "immo.publisherAddMember",
        entity: { type: "immo_publisher", id: publisherId },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
      });
      return respond(errorResponse(403, "FORBIDDEN", "Only publisher owner or admin can add members."));
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return respond(errorResponse(400, "INVALID_BODY", "Invalid JSON body."));
  }

  const userId = normalizeString((body as { userId?: unknown }).userId);
  const role = parseMemberRole((body as { role?: unknown }).role);

  if (!userId) {
    return respond(errorResponse(400, "VALIDATION_ERROR", "userId is required."));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return respond(errorResponse(404, "USER_NOT_FOUND", "User not found."));
  }

  const member = await prisma.immoPublisherMember.upsert({
    where: {
      publisherId_userId: {
        publisherId,
        userId,
      },
    },
    update: {
      role,
      status: "ACTIVE",
    },
    create: {
      publisherId,
      userId,
      role,
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
    action: "immo.publisherAddMember",
    entity: { type: "immo_publisher_member", id: member.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { publisherId, memberRole: role },
  });

  return respond(NextResponse.json({ member }, { status: 201 }));
}
