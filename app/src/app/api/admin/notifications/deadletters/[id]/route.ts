import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";
import { redactError } from "@/lib/notifications/redact";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type DeadletterHint =
  | "TEMPLATE_MISSING"
  | "PROVIDER_AUTH"
  | "RATE_LIMIT"
  | "INVALID_RECIPIENT"
  | "NETWORK"
  | "UNKNOWN";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function payloadKeysFromJson(value: Prisma.JsonValue): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.keys(value as Record<string, unknown>)
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .slice(0, 32);
}

function classifyHint(lastError: string | null | undefined): DeadletterHint {
  const value = String(lastError ?? "").toUpperCase();

  if (!value) return "UNKNOWN";
  if (value.includes("TEMPLATE")) return "TEMPLATE_MISSING";
  if (
    value.includes("AUTH") ||
    value.includes("UNAUTHORIZED") ||
    value.includes("FORBIDDEN") ||
    value.includes("API_KEY") ||
    value.includes("SIGNATURE")
  ) {
    return "PROVIDER_AUTH";
  }
  if (value.includes("RATE") || value.includes("429") || value.includes("THROTTLE")) {
    return "RATE_LIMIT";
  }
  if (
    value.includes("RECIPIENT") ||
    value.includes("INVALID_EMAIL") ||
    value.includes("INVALID_RECIPIENT") ||
    value.includes("ADDRESS") ||
    value.includes("BOUNCE")
  ) {
    return "INVALID_RECIPIENT";
  }
  if (
    value.includes("NETWORK") ||
    value.includes("TIMEOUT") ||
    value.includes("ECONN") ||
    value.includes("EAI_AGAIN") ||
    value.includes("DNS")
  ) {
    return "NETWORK";
  }

  return "UNKNOWN";
}

export async function GET(_request: NextRequest, context: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "NO_SESSION", "Authentication required.");
  }

  if (!hasUserRole(session.user, "ADMIN")) {
    return errorResponse(403, "FORBIDDEN", "Admin access required.");
  }

  const { id } = await context.params;
  if (!id) {
    return errorResponse(400, "VALIDATION_ERROR", "Missing deadletter id.");
  }

  try {
    const row = await prisma.emailOutbox.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        kind: true,
        status: true,
        templateKey: true,
        dedupeKey: true,
        attempts: true,
        scheduledAt: true,
        sentAt: true,
        updatedAt: true,
        providerMessageId: true,
        lastError: true,
        payloadJson: true,
      },
    });

    if (!row || (row.status !== "FAILED" && row.status !== "CANCELLED")) {
      return errorResponse(404, "NOT_FOUND", "Deadletter not found.");
    }

    const redactedLastError = redactError(row.lastError);

    return NextResponse.json({
      ok: true,
      code: "NOTIFICATION_DEADLETTER",
      item: {
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        status: row.status,
        templateKey: row.templateKey,
        dedupeKey: row.dedupeKey,
        attempts: row.attempts,
        scheduledAt: row.scheduledAt,
        sentAt: row.sentAt,
        updatedAt: row.updatedAt,
        providerMessageId: row.providerMessageId,
        lastError: redactedLastError,
        payloadKeys: payloadKeysFromJson(row.payloadJson),
        hint: classifyHint(redactedLastError),
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
