import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  requireTrustSession,
  trustAudit,
  trustError,
  trustJson,
} from "@/app/api/trust/_shared";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ blockedUserId: string }> }
) {
  const correlationId = getCorrelationId(request);
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return trustError("FORBIDDEN", "Cross-origin request blocked.", 403, correlationId);

  if (!hasTrustDelegates()) {
    return trustError("SERVICE_UNAVAILABLE", "Trust features unavailable. Run prisma generate and restart.", 503, correlationId);
  }
  const auth = await requireTrustSession(correlationId);
  if (auth.response) return auth.response;
  const session = auth.session!;
  const { blockedUserId } = await params;

  const db = getTrustDb();
  const result = await db.userBlock.deleteMany({
    where: { blockerId: session.user.id, blockedId: blockedUserId },
  });

  if (!result?.count) {
    return trustError("NOT_FOUND", "Block not found.", 404, correlationId);
  }

  trustAudit({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "UNBLOCK_USER",
    entity: { type: "user_block", id: blockedUserId },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { blockedUserId },
  });

  return trustJson({ ok: true, code: "BLOCK_REMOVED", blockedUserId }, undefined, correlationId);
}
