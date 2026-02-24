import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

const intentSelect = {
  id: true,
  sourceVertical: true,
  sourceEntityId: true,
  intentType: true,
  objectType: true,
  weightKg: true,
  fromCountry: true,
  toCountry: true,
  fromCity: true,
  toCity: true,
  status: true,
  targetVertical: true,
  targetEntityId: true,
  matchedAt: true,
  closedAt: true,
  expiredAt: true,
  createdByUserId: true,
  createdAt: true,
} as const;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeIntent(intent: {
  id: string;
  sourceVertical: string;
  sourceEntityId: string;
  intentType: string;
  objectType: string;
  weightKg: number | null;
  fromCountry: string | null;
  toCountry: string | null;
  fromCity: string | null;
  toCity: string | null;
  status: string;
  targetVertical: string | null;
  targetEntityId: string | null;
  matchedAt: Date | null;
  closedAt: Date | null;
  expiredAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
}) {
  return {
    ...intent,
    matchedAt: intent.matchedAt?.toISOString() ?? null,
    closedAt: intent.closedAt?.toISOString() ?? null,
    expiredAt: intent.expiredAt?.toISOString() ?? null,
    createdAt: intent.createdAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await context.params;
  const intent = await prisma.crossVerticalIntent.findUnique({
    where: { id },
    select: intentSelect,
  });

  if (!intent) {
    return errorResponse(404, "NOT_FOUND", "Intent not found.");
  }

  const isAdmin = hasUserRole(session.user, "ADMIN");
  if (!isAdmin && intent.createdByUserId !== session.user.id) {
    return errorResponse(403, "FORBIDDEN", "Access denied.");
  }

  return NextResponse.json({ intent: serializeIntent(intent) });
}


export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return withCorrelationId(errorResponse(401, "UNAUTHORIZED", "Authentication required."), correlationId);
  }

  const { id } = await context.params;
  const existing = await prisma.crossVerticalIntent.findUnique({
    where: { id },
    select: intentSelect,
  });

  if (!existing) {
    return withCorrelationId(errorResponse(404, "NOT_FOUND", "Intent not found."), correlationId);
  }

  const isAdmin = hasUserRole(session.user, "ADMIN");
  if (!isAdmin && existing.createdByUserId !== session.user.id) {
    return withCorrelationId(errorResponse(403, "FORBIDDEN", "Access denied."), correlationId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return withCorrelationId(errorResponse(400, "INVALID_BODY", "Invalid JSON body."), correlationId);
  }

  const nextStatus = normalizeString((body as { status?: unknown }).status).toUpperCase();
  const targetVertical = normalizeString((body as { targetVertical?: unknown }).targetVertical).toUpperCase();
  const targetEntityId = normalizeString((body as { targetEntityId?: unknown }).targetEntityId);

  if (!["CLOSED", "EXPIRED", "MATCHED"].includes(nextStatus)) {
    return withCorrelationId(
      errorResponse(400, "INVALID_STATUS", "status must be CLOSED, EXPIRED or MATCHED."),
      correlationId
    );
  }

  if (existing.status === "CLOSED" || existing.status === "EXPIRED") {
    return withCorrelationId(
      errorResponse(409, "TERMINAL_INTENT", "CLOSED and EXPIRED intents are terminal."),
      correlationId
    );
  }

  if (nextStatus === "MATCHED") {
    if (targetVertical !== "GP") {
      return withCorrelationId(
        errorResponse(400, "INVALID_TARGET", "MATCHED requires targetVertical=GP."),
        correlationId
      );
    }
    if (!targetEntityId) {
      return withCorrelationId(
        errorResponse(400, "INVALID_TARGET", "MATCHED requires targetEntityId."),
        correlationId
      );
    }

    const targetTrip = await prisma.gpTrip.findUnique({
      where: { id: targetEntityId },
      select: { id: true, transporterId: true },
    });
    if (!targetTrip) {
      return withCorrelationId(
        errorResponse(404, "TARGET_NOT_FOUND", "Target GP entity not found."),
        correlationId
      );
    }
    if (!isAdmin && targetTrip.transporterId !== session.user.id) {
      return withCorrelationId(
        errorResponse(403, "TARGET_NOT_OWNED", "Target GP entity is not owned by current user."),
        correlationId
      );
    }
  }

  const now = new Date();
  const data: Record<string, unknown> = {
    status: nextStatus,
  };

  if (nextStatus === "MATCHED") {
    data.targetVertical = "GP";
    data.targetEntityId = targetEntityId;
    data.matchedAt = now;
  } else if (nextStatus === "CLOSED") {
    data.closedAt = now;
  } else if (nextStatus === "EXPIRED") {
    data.expiredAt = now;
  }

  const updatedCount = await prisma.crossVerticalIntent.updateMany({
    where: { id, status: "OPEN" },
    data,
  });

  if (updatedCount.count === 0) {
    return withCorrelationId(
      errorResponse(409, "INVALID_INTENT_STATE", "Intent is no longer OPEN."),
      correlationId
    );
  }

  const updated = await prisma.crossVerticalIntent.findUnique({ where: { id }, select: intentSelect });
  if (!updated) {
    return withCorrelationId(errorResponse(404, "NOT_FOUND", "Intent not found."), correlationId);
  }

  const action = nextStatus === "MATCHED" ? "orchestrator.intentMatched" : nextStatus === "CLOSED" ? "orchestrator.intentClosed" : "orchestrator.intentExpired";
  auditLog({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action,
    entity: { type: "cross_vertical_intent", id: updated.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: {
      fromStatus: existing.status,
      toStatus: updated.status,
      targetVertical: updated.targetVertical,
      targetEntityId: updated.targetEntityId,
      sourceVertical: updated.sourceVertical,
      sourceEntityId: updated.sourceEntityId,
    },
  });

  return withCorrelationId(NextResponse.json({ intent: serializeIntent(updated) }), correlationId);
}
