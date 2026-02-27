import { NextRequest, NextResponse } from "next/server";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertAllowedHost } from "@/lib/request-security";
import { NotificationService } from "@/lib/notifications/NotificationService";

function readCronSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return request.headers.get("x-cron-secret")?.trim() || "";
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const actor = { system: true as const };
  const action = "notifications.cronDispatch";

  const hostBlocked = assertAllowedHost(request);
  if (hostBlocked) return respond(hostBlocked);

  const expectedSecret = String(process.env.CRON_SECRET ?? "").trim();
  if (!expectedSecret) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "EmailOutbox" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(
      NextResponse.json(
        {
          ok: false,
          error: "CRON_SECRET_MISSING",
          message: "CRON_SECRET is required.",
        },
        { status: 500 }
      )
    );
  }

  const providedSecret = readCronSecret(request);
  if (!providedSecret || providedSecret !== expectedSecret) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "EmailOutbox" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }));
  }

  const body = await request.json().catch(() => null);
  const rawLimit = Number((body as { limit?: unknown } | null)?.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.round(rawLimit), 1), 200) : 50;

  try {
    const paymentReminders = await NotificationService.schedulePaymentReminders({
      hours: 24,
      limit: 150,
    });
    const dealsDigest = await NotificationService.scheduleDealsDigestEmails({
      userLimit: 150,
      dealsLimit: 8,
    });
    const batchResult = await NotificationService.sendPendingBatch({ limit });

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "EmailOutbox" },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        processed: batchResult.processed,
        sent: batchResult.sent,
        failed: batchResult.failed,
        skipped: batchResult.skipped,
        paymentReminderQueued: paymentReminders.queued,
        dealsDigestQueued: dealsDigest.queued,
      },
    });

    return respond(
      NextResponse.json({
        ok: true,
        code: "CRON_NOTIFICATIONS_PROCESSED",
        processed: batchResult.processed,
        sent: batchResult.sent,
        failed: batchResult.failed,
        skipped: batchResult.skipped,
        queued: {
          paymentReminders: paymentReminders.queued,
          dealsDigest: dealsDigest.queued,
        },
      })
    );
  } catch {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "EmailOutbox" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });

    return respond(
      NextResponse.json(
        {
          ok: false,
          error: "CRON_NOTIFICATIONS_FAILED",
          message: "Notification cron dispatch failed.",
        },
        { status: 503 }
      )
    );
  }
}
