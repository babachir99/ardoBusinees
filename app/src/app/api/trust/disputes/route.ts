import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  parseTakeSkip,
  parseVertical,
  requireTrustAdmin,
  requireTrustSession,
  serializeTrustDispute,
  trustAudit,
  trustError,
  trustJson,
  validateReasonAndDescription,
  enforceTrustCreateRateLimit,
  TRUST_DUPLICATE_WINDOW_MS,
} from "@/app/api/trust/_shared";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return trustError("FORBIDDEN", "Cross-origin request blocked.", 403, correlationId);

  if (!hasTrustDelegates()) {
    return trustError("SERVICE_UNAVAILABLE", "Trust features unavailable. Run prisma generate and restart.", 503, correlationId);
  }

  const auth = await requireTrustSession(correlationId);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const rateLimited = await enforceTrustCreateRateLimit(request, correlationId, "disputes", session.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const vertical = parseVertical(body?.vertical);
  const validation = validateReasonAndDescription(body?.reason, body?.description);
  const orderId = String(body?.orderId ?? "").trim() || null;
  if (!vertical || validation.error) {
    return trustError("VALIDATION_ERROR", validation.error ?? "Invalid vertical.", 400, correlationId);
  }

  const db = getTrustDb();
  const duplicateSince = new Date(Date.now() - TRUST_DUPLICATE_WINDOW_MS);
  const duplicate = await db.trustDispute.findFirst({
    where: {
      userId: session.user.id,
      vertical,
      orderId,
      reason: validation.reason,
      createdAt: { gte: duplicateSince },
    },
    select: { id: true },
  });
  if (duplicate) {
    return trustError("DUPLICATE_TRUST_DISPUTE", "A similar dispute was already submitted recently.", 409, correlationId);
  }

  const created = await db.trustDispute.create({
    data: {
      userId: session.user.id,
      orderId,
      vertical,
      reason: validation.reason,
      description: validation.description,
      status: "OPEN",
    },
    include: { user: { select: { id: true, name: true } } },
  });

  trustAudit({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "CREATE_DISPUTE",
    entity: { type: "trust_dispute", id: created.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { vertical, orderId },
  });

  return trustJson({ ok: true, code: "DISPUTE_CREATED", dispute: serializeTrustDispute(created) }, { status: 201 }, correlationId);
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  if (!hasTrustDelegates()) {
    return trustError("SERVICE_UNAVAILABLE", "Trust features unavailable. Run prisma generate and restart.", 503, correlationId);
  }

  const auth = await requireTrustSession(correlationId);
  if (auth.response) return auth.response;
  const adminBlocked = requireTrustAdmin(auth.session, correlationId);
  if (adminBlocked) return adminBlocked;

  const url = new URL(request.url);
  const { take, skip } = parseTakeSkip(url);
  const statusParam = String(url.searchParams.get("status") ?? "").trim().toUpperCase();
  const status = statusParam === "UNDER_REVIEW" ? "IN_REVIEW" : statusParam;
  const where = (["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"].includes(status) ? { status } : {}) as Record<string, unknown>;

  const db = getTrustDb();
  const [items, total] = await Promise.all([
    db.trustDispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { user: { select: { id: true, name: true } } },
    }),
    db.trustDispute.count({ where }),
  ]);

  return trustJson(
    {
      ok: true,
      code: "DISPUTES_LIST",
      disputes: items.map(serializeTrustDispute),
      pagination: { take, skip, total },
    },
    undefined,
    correlationId
  );
}
