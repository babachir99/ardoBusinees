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

function toAgeSeconds(timestamp: Date | null): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return errorResponse(401, "NO_SESSION", "Authentication required.");
    }

    if (!hasUserRole(session.user, "ADMIN")) {
      return errorResponse(403, "FORBIDDEN", "Admin access required.");
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      pendingCount,
      sentCount,
      failedCount,
      cancelledCount,
      oldestPending,
      failedLast24h,
      sentLast24h,
      failedTemplates,
    ] =
      await Promise.all([
        prisma.emailOutbox.count({
          where: { status: "PENDING" },
        }),
        prisma.emailOutbox.count({
          where: { status: "SENT" },
        }),
        prisma.emailOutbox.count({
          where: { status: "FAILED" },
        }),
        prisma.emailOutbox.count({
          where: { status: "CANCELLED" },
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
        prisma.emailOutbox.findMany({
          where: { status: "FAILED" },
          distinct: ["templateKey"],
          select: { templateKey: true },
        }),
      ]);

    const counts: Record<EmailOutboxStatus, number> = {
      PENDING: pendingCount,
      SENT: sentCount,
      FAILED: failedCount,
      CANCELLED: cancelledCount,
    };

    const templateFailureCounts = await Promise.all(
      failedTemplates.map(async ({ templateKey }) => ({
        templateKey,
        count: await prisma.emailOutbox.count({
          where: {
            status: "FAILED",
            templateKey,
          },
        }),
      }))
    );

    const topTemplateFailures = templateFailureCounts
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
