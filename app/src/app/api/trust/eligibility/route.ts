import { NextRequest } from "next/server";
import { canTrustAction } from "@/lib/trust-eligibility";
import {
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  requireTrustSession,
  trustError,
  trustJson,
} from "@/app/api/trust/_shared";

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  if (!hasTrustDelegates()) {
    return trustError(
      "SERVICE_UNAVAILABLE",
      "Trust features unavailable. Run prisma generate and restart.",
      503,
      correlationId
    );
  }

  const auth = await requireTrustSession(correlationId);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const url = new URL(request.url);
  const targetUserId = String(url.searchParams.get("targetUserId") ?? "").trim();
  if (!targetUserId) {
    return trustError("VALIDATION_ERROR", "targetUserId is required.", 400, correlationId);
  }

  const db = getTrustDb();
  const targetUser = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!targetUser) {
    return trustError("NOT_FOUND", "User not found.", 404, correlationId);
  }

  const eligible = await canTrustAction(db, session.user.id, targetUserId);

  return trustJson(
    {
      ok: true,
      code: "ELIGIBILITY",
      eligible,
      reason: eligible ? "HAS_INTERACTION" : "NO_INTERACTION",
    },
    undefined,
    correlationId
  );
}
