import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { EmailOutboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";

void NextRequest;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

const OUTBOX_STATUSES: EmailOutboxStatus[] = ["PENDING", "SENT", "FAILED", "CANCELLED"];

function toAgeSeconds(timestamp: Date | null): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000));
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "NO_SESSION", "Authentication required.");
  }

  if (!hasUserRole(session.user, "ADMIN")) {
    return errorResponse(403, "FORBIDDEN", "Admin access required.");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const [statusGroups, oldestPending, failedLast24h, sentLast24h, templateFailureGroups] =
      await Promise.all([
        prisma.emailOutbox.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.emailOutbox.findFirst({
          where: { status: "PENDING" },
          orderBy: { scheduledAt: "asc" },
          select: { scheduledAt: true },
        }),
        prisma.emailOutbox.count({
          where: {
            status: "FAILED",
            updatedAt: { gte: since },
          },
        }),
        prisma.emailOutbox.count({
          where: {
            status: "SENT",
            sentAt: { gte: since },
          },
        }),
        prisma.emailOutbox.groupBy({
          by: ["templateKey"],
          where: { status: "FAILED" },
          _count: { _all: true },
        }),
      ]);

    const counts: Record<EmailOutboxStatus, number> = {
      PENDING: 0,
      SENT: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    for (const status of OUTBOX_STATUSES) {
      const group = statusGroups.find((entry) => entry.status === status);
      counts[status] = group?._count._all ?? 0;
    }

    const topTemplateFailures = templateFailureGroups
      .map((entry) => ({
        templateKey: entry.templateKey,
        count: entry._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      code: "NOTIFICATIONS_HEALTH",
      health: {
        counts,
        oldestPendingAgeSeconds: toAgeSeconds(oldestPending?.scheduledAt ?? null),
        failedLast24h,
        sentLast24h,
        topTemplateFailures,
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
