import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  parseReportStatus,
  parseAssignedAdminInput,
  parseTakeSkip,
  requireTrustAdmin,
  requireTrustSession,
  serializeReport,
  trustAudit,
  trustError,
  trustJson,
  validateReasonAndDescription,
  parseProofUrls,
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

  const rateLimited = await enforceTrustCreateRateLimit(request, correlationId, "reports", session.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const reportedUserId = String(body?.reportedUserId ?? "").trim();
  const validation = validateReasonAndDescription(body?.reason, body?.description);
  const proofUrls = parseProofUrls(body?.proofUrls);
  if (!reportedUserId || validation.error || !proofUrls) {
    return trustError("VALIDATION_ERROR", validation.error ?? (!proofUrls ? "Invalid proofUrls." : "reportedUserId is required."), 400, correlationId);
  }
  if (reportedUserId === session.user.id) {
    return trustError("VALIDATION_ERROR", "You cannot report your own account.", 400, correlationId);
  }

  const db = getTrustDb();
  const reportedUser = await db.user.findUnique({ where: { id: reportedUserId }, select: { id: true, name: true } });
  if (!reportedUser) {
    return trustError("NOT_FOUND", "Reported user not found.", 404, correlationId);
  }

  const duplicateSince = new Date(Date.now() - TRUST_DUPLICATE_WINDOW_MS);
  const duplicate = await db.report.findFirst({
    where: {
      reporterId: session.user.id,
      reportedId: reportedUserId,
      reason: validation.reason,
      createdAt: { gte: duplicateSince },
    },
    select: { id: true },
  });
  if (duplicate) {
    return trustError("DUPLICATE_REPORT", "A similar report was already submitted recently.", 409, correlationId);
  }

  const created = await db.report.create({
    data: {
      reporterId: session.user.id,
      reportedId: reportedUserId,
      reason: validation.reason,
      description: validation.description,
      proofUrls,
      status: "PENDING",
    },
    include: {
      reporter: { select: { id: true, name: true } },
      reported: { select: { id: true, name: true } },
    },
  });

  trustAudit({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "CREATE_REPORT",
    entity: { type: "report", id: created.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { reportedId: reportedUserId },
  });

  return trustJson({ ok: true, code: "REPORT_CREATED", report: serializeReport(created) }, { status: 201 }, correlationId);
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
  const status = parseReportStatus(url.searchParams.get("status"));
  const assignedAdminInput = parseAssignedAdminInput(url.searchParams.get("assignedAdminId"));

  const db = getTrustDb();
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (assignedAdminInput.provided) where.assignedAdminId = assignedAdminInput.value;
  const [items, total] = await Promise.all([
    db.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        reporter: { select: { id: true, name: true } },
        reported: { select: { id: true, name: true } },
        assignedAdmin: { select: { id: true, name: true } },
      },
    }),
    db.report.count({ where }),
  ]);

  return trustJson(
    {
      ok: true,
      code: "REPORTS_LIST",
      reports: items.map(serializeReport),
      pagination: { take, skip, total },
    },
    undefined,
    correlationId
  );
}
