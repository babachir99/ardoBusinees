import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  parseTrustDisputeStatusInput,
  requireTrustAdmin,
  requireTrustSession,
  serializeTrustDispute,
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
  const status = parseTrustDisputeStatusInput(body?.status);
  if (!status) {
    return trustError("VALIDATION_ERROR", "Invalid dispute status.", 400, correlationId);
  }

  const db = getTrustDb();
  const updated = await db.trustDispute.update({
    where: { id },
    data: { status },
    include: { user: { select: { id: true, name: true } } },
  }).catch((error: any) => {
    if (error?.code === "P2025") return null;
    throw error;
  });

  if (!updated) {
    trustAudit({
      correlationId,
      actor: { userId: auth.session!.user.id, role: auth.session!.user.role ?? null },
      action: "UPDATE_DISPUTE_STATUS",
      entity: { type: "trust_dispute", id },
      outcome: "ERROR",
      reason: AuditReason.NOT_FOUND,
    });
    return trustError("NOT_FOUND", "Dispute not found.", 404, correlationId);
  }

  trustAudit({
    correlationId,
    actor: { userId: auth.session!.user.id, role: auth.session!.user.role ?? null },
    action: "UPDATE_DISPUTE_STATUS",
    entity: { type: "trust_dispute", id: updated.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { status },
  });

  return trustJson({ ok: true, code: "DISPUTE_STATUS_UPDATED", dispute: serializeTrustDispute(updated) }, undefined, correlationId);
}
