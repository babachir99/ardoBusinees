import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  parseReportStatus,
  requireTrustAdmin,
  requireTrustSession,
  serializeReport,
  trustAudit,
  trustError,
  trustJson,
} from "@/app/api/trust/_shared";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return trustError("FORBIDDEN", "Cross-origin request blocked.", 403, correlationId);

  if (!hasTrustDelegates()) {
    return trustError("SERVICE_UNAVAILABLE", "Trust features unavailable. Run prisma generate and restart.", 503, correlationId);
  }

  const auth = await requireTrustSession(correlationId);
  if (auth.response) return auth.response;
  const adminBlocked = requireTrustAdmin(auth.session, correlationId);
  if (adminBlocked) return adminBlocked;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = parseReportStatus(body?.status);
  if (!status) {
    return trustError("VALIDATION_ERROR", "Invalid report status.", 400, correlationId);
  }

  const db = getTrustDb();
  const updated = await db.report.update({
    where: { id },
    data: { status },
    include: {
      reporter: { select: { id: true, name: true } },
      reported: { select: { id: true, name: true } },
    },
  }).catch((error: any) => {
    if (error?.code === "P2025") return null;
    throw error;
  });

  if (!updated) {
    trustAudit({
      correlationId,
      actor: { userId: auth.session!.user.id, role: auth.session!.user.role ?? null },
      action: "UPDATE_REPORT_STATUS",
      entity: { type: "report", id },
      outcome: "ERROR",
      reason: AuditReason.NOT_FOUND,
    });
    return trustError("NOT_FOUND", "Report not found.", 404, correlationId);
  }

  trustAudit({
    correlationId,
    actor: { userId: auth.session!.user.id, role: auth.session!.user.role ?? null },
    action: "UPDATE_REPORT_STATUS",
    entity: { type: "report", id: updated.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { status },
  });

  return trustJson({ ok: true, code: "REPORT_STATUS_UPDATED", report: serializeReport(updated) }, undefined, correlationId);
}
