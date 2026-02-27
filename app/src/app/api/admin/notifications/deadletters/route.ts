import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { EmailOutboxStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";
import { redactError } from "@/lib/notifications/redact";

type DeadletterCursor = {
  updatedAt: string;
  id: string;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 1), max);
}

function parseCursor(raw: string | null): DeadletterCursor | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as DeadletterCursor;
    if (!parsed?.id || !parsed?.updatedAt) return null;
    if (!Number.isFinite(new Date(parsed.updatedAt).getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function serializeCursor(cursor: DeadletterCursor | null): string | null {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

function payloadKeysFromJson(value: Prisma.JsonValue): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.keys(value as Record<string, unknown>)
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .slice(0, 32);
}

function getStatuses(includeCancelled: boolean): EmailOutboxStatus[] {
  return includeCancelled ? ["FAILED", "CANCELLED"] : ["FAILED"];
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "NO_SESSION", "Authentication required.");
  }

  if (!hasUserRole(session.user, "ADMIN")) {
    return errorResponse(403, "FORBIDDEN", "Admin access required.");
  }

  const { searchParams } = new URL(request.url);
  const take = parsePositiveInt(searchParams.get("take"), 50, 100);
  const includeCancelled = searchParams.get("includeCancelled") === "true";
  const cursor = parseCursor(searchParams.get("cursor"));

  if (searchParams.get("cursor") && !cursor) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid cursor.");
  }

  const statuses = getStatuses(includeCancelled);
  const cursorDate = cursor ? new Date(cursor.updatedAt) : null;

  try {
    const rows = await prisma.emailOutbox.findMany({
      where: {
        status: { in: statuses },
        ...(cursor && cursorDate
          ? {
              OR: [
                { updatedAt: { lt: cursorDate } },
                {
                  updatedAt: cursorDate,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        userId: true,
        kind: true,
        templateKey: true,
        dedupeKey: true,
        attempts: true,
        scheduledAt: true,
        sentAt: true,
        updatedAt: true,
        providerMessageId: true,
        lastError: true,
        payloadJson: true,
        status: true,
      },
    });

    const hasMore = rows.length > take;
    const pageItems = hasMore ? rows.slice(0, take) : rows;
    const next = hasMore ? pageItems[pageItems.length - 1] : null;

    return NextResponse.json({
      ok: true,
      code: "NOTIFICATION_DEADLETTERS",
      items: pageItems.map((row) => ({
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
        lastError: redactError(row.lastError),
        payloadKeys: payloadKeysFromJson(row.payloadJson),
      })),
      page: {
        take,
        nextCursor: serializeCursor(
          next
            ? {
                id: next.id,
                updatedAt: next.updatedAt.toISOString(),
              }
            : null
        ),
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
