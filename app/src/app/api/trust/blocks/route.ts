import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/request-security";
import {
  AuditReason,
  getCorrelationId,
  getTrustDb,
  hasTrustDelegates,
  parseTakeSkip,
  requireTrustSession,
  serializeBlock,
  trustAudit,
  trustError,
  trustJson,
} from "@/app/api/trust/_shared";

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  if (!hasTrustDelegates()) {
    return trustError("SERVICE_UNAVAILABLE", "Trust features unavailable. Run prisma generate and restart.", 503, correlationId);
  }
  const auth = await requireTrustSession(correlationId);
  if (auth.response) return auth.response;

  const { take, skip } = parseTakeSkip(new URL(request.url));
  const db = getTrustDb();
  const [items, total] = await Promise.all([
    db.userBlock.findMany({
      where: { blockerId: auth.session!.user.id },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { blocked: { select: { id: true, name: true } } },
    }),
    db.userBlock.count({ where: { blockerId: auth.session!.user.id } }),
  ]);

  return trustJson(
    {
      ok: true,
      code: "BLOCKS_LIST",
      blocks: items.map(serializeBlock),
      pagination: { take, skip, total },
    },
    undefined,
    correlationId
  );
}

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

  const body = await request.json().catch(() => null);
  const blockedUserId = String(body?.blockedUserId ?? "").trim();
  if (!blockedUserId) {
    return trustError("VALIDATION_ERROR", "blockedUserId is required.", 400, correlationId);
  }
  if (blockedUserId === session.user.id) {
    return trustError("VALIDATION_ERROR", "You cannot block yourself.", 400, correlationId);
  }

  const db = getTrustDb();
  const blockedUser = await db.user.findUnique({ where: { id: blockedUserId }, select: { id: true, name: true } });
  if (!blockedUser) {
    return trustError("NOT_FOUND", "User not found.", 404, correlationId);
  }

  const existing = await db.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: blockedUserId } },
    include: { blocked: { select: { id: true, name: true } } },
  }).catch(() => null);

  if (existing) {
    return trustJson({ ok: true, code: "BLOCK_ALREADY_EXISTS", block: serializeBlock(existing) }, undefined, correlationId);
  }

  const created = await db.userBlock.create({
    data: { blockerId: session.user.id, blockedId: blockedUserId },
    include: { blocked: { select: { id: true, name: true } } },
  });

  trustAudit({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "BLOCK_USER",
    entity: { type: "user_block", id: created.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: { blockedUserId },
  });

  return trustJson({ ok: true, code: "BLOCK_CREATED", block: serializeBlock(created) }, { status: 201 }, correlationId);
}
