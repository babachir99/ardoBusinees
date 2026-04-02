import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustAdminRole,
  hasTrustDelegates,
  parseAssignedAdminInput,
  parseInternalNoteInput,
  parseOptionalTrustDisputeStatus,
  parseResolutionCodeInput,
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
  if (!body || typeof body !== "object") {
    return trustError("VALIDATION_ERROR", "Invalid JSON body.", 400, correlationId);
  }

  const db = getTrustDb();
  const existing = await db.trustDispute.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      assignedAdmin: { select: { id: true, name: true } },
    },
  });

  if (!existing) {
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

  const hasStatusField = Object.prototype.hasOwnProperty.call(body, "status");
  const status = parseOptionalTrustDisputeStatus((body as Record<string, unknown>).status);
  if (hasStatusField && !status) {
    return trustError("VALIDATION_ERROR", "Invalid dispute status.", 400, correlationId);
  }

  const hasAssignedAdminField = Object.prototype.hasOwnProperty.call(body, "assignedAdminId");
  let assignedAdminInput = parseAssignedAdminInput((body as Record<string, unknown>).assignedAdminId);
  if (hasAssignedAdminField && (body as Record<string, unknown>).assignedAdminId === null) {
    assignedAdminInput = { provided: true as const, value: null as string | null };
  }
  const noteInput = parseInternalNoteInput((body as Record<string, unknown>).internalNote);
  const resolutionCodeInput = parseResolutionCodeInput((body as Record<string, unknown>).resolutionCode);

  const data: Record<string, unknown> = {};

  if (hasStatusField && status) {
    data.status = status;
    data.reviewedAt = status === "OPEN" ? null : new Date();
  }

  if (assignedAdminInput.provided) {
    if (assignedAdminInput.value) {
      const assignedAdmin = await db.user.findUnique({
        where: { id: assignedAdminInput.value },
        select: {
          id: true,
          role: true,
          roleAssignments: { select: { role: true, status: true } },
        },
      });
      if (!assignedAdmin || !hasTrustAdminRole(assignedAdmin)) {
        return trustError("VALIDATION_ERROR", "assignedAdminId must reference an admin user.", 400, correlationId);
      }
    }
    data.assignedAdminId = assignedAdminInput.value;
  }

  if (noteInput.provided) {
    data.internalNote = noteInput.value;
  }

  if (resolutionCodeInput.provided) {
    data.resolutionCode = resolutionCodeInput.value;
  }

  if (Object.keys(data).length === 0) {
    return trustError("VALIDATION_ERROR", "No updates provided.", 400, correlationId);
  }

  const updated = await db.trustDispute.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true } },
      assignedAdmin: { select: { id: true, name: true } },
    },
  });

  trustAudit({
    correlationId,
    actor: { userId: auth.session!.user.id, role: auth.session!.user.role ?? null },
    action: "UPDATE_DISPUTE_STATUS",
    entity: { type: "trust_dispute", id: updated.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: {
      updatedFields: Object.keys(data),
      status: status ?? undefined,
      assignedAdminId: assignedAdminInput.provided ? assignedAdminInput.value : undefined,
    },
  });

  return trustJson({ ok: true, code: "DISPUTE_UPDATED", dispute: serializeTrustDispute(updated) }, undefined, correlationId);
}
