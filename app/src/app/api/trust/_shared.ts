import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { checkRateLimitAsync, getRateLimitHeaders, resolveClientIp } from "@/lib/rate-limit";

export const TRUST_VERTICALS = ["SHOP", "PRESTA", "GP", "TIAK", "IMMO", "CARS"] as const;
export const REPORT_STATUSES = ["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;
export const TRUST_DISPUTE_STATUSES_PUBLIC = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;
export const TRUST_DISPUTE_STATUS_DB = ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] as const;

export type TrustPublicDisputeStatus = (typeof TRUST_DISPUTE_STATUSES_PUBLIC)[number];

export const TRUST_DUPLICATE_WINDOW_MS = 60 * 60 * 1000;

export async function enforceTrustCreateRateLimit(
  request: Request,
  correlationId: string,
  scope: "reports" | "disputes",
  userId: string
) {
  const ip = resolveClientIp(request);
  const [ipRate, userRate] = await Promise.all([
    checkRateLimitAsync({ key: `trust:${scope}:ip:${ip}`, limit: 15, windowMs: 15 * 60 * 1000 }),
    checkRateLimitAsync({ key: `trust:${scope}:user:${userId}`, limit: 8, windowMs: 15 * 60 * 1000 }),
  ]);

  const blocked = !ipRate.allowed ? ipRate : !userRate.allowed ? userRate : null;
  if (!blocked) return null;

  return trustJson(
    { ok: false, code: "RATE_LIMITED", message: "Too many requests. Please retry later." },
    { status: 429, headers: getRateLimitHeaders(blocked) },
    correlationId
  );
}

export function getTrustDb() {
  return prisma as any;
}

export function hasTrustDelegates() {
  const db = getTrustDb();
  return Boolean(db?.report && db?.trustDispute && db?.userBlock);
}

export function trustJson<T extends Record<string, unknown>>(
  payload: T,
  init?: ResponseInit,
  correlationId?: string
) {
  const response = NextResponse.json(payload, init);
  if (correlationId) {
    return withCorrelationId(response, correlationId);
  }
  return response;
}

export function trustError(
  code: string,
  message: string,
  status: number,
  correlationId?: string,
  extra?: Record<string, unknown>
) {
  return trustJson({ ok: false, code, message, ...(extra ?? {}) }, { status }, correlationId);
}

export async function requireTrustSession(correlationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { session: null, response: trustError("NO_SESSION", "Authentication required.", 401, correlationId) };
  }
  return { session, response: null as NextResponse | null };
}

export function requireTrustAdmin(session: any, correlationId: string) {
  if (!session?.user?.id) {
    return trustError("NO_SESSION", "Authentication required.", 401, correlationId);
  }
  if (!hasUserRole(session.user, "ADMIN")) {
    return trustError("FORBIDDEN", "Admin access required.", 403, correlationId);
  }
  return null;
}

export function parseTakeSkip(url: URL, defaults = { take: 20, skip: 0, maxTake: 50, maxSkip: 5000 }) {
  const rawTake = Number(url.searchParams.get("take") ?? defaults.take);
  const rawSkip = Number(url.searchParams.get("skip") ?? defaults.skip);
  const take = Number.isFinite(rawTake)
    ? Math.min(defaults.maxTake, Math.max(1, Math.trunc(rawTake)))
    : defaults.take;
  const skip = Number.isFinite(rawSkip)
    ? Math.min(defaults.maxSkip, Math.max(0, Math.trunc(rawSkip)))
    : defaults.skip;
  return { take, skip };
}

export function validateReasonAndDescription(reason: unknown, description: unknown) {
  const normalizedReason = String(reason ?? "").trim();
  const normalizedDescription = String(description ?? "").trim();

  if (normalizedReason.length < 3) {
    return { error: "Reason must be at least 3 characters.", reason: normalizedReason, description: normalizedDescription };
  }
  if (normalizedDescription.length < 10) {
    return { error: "Description must be at least 10 characters.", reason: normalizedReason, description: normalizedDescription };
  }

  return { error: null as string | null, reason: normalizedReason.slice(0, 120), description: normalizedDescription.slice(0, 2000) };
}

export function parseVertical(value: unknown) {
  const vertical = String(value ?? "").trim().toUpperCase();
  return (TRUST_VERTICALS as readonly string[]).includes(vertical) ? vertical : null;
}

export function parseReportStatus(value: unknown) {
  const status = String(value ?? "").trim().toUpperCase();
  return (REPORT_STATUSES as readonly string[]).includes(status) ? status : null;
}

export function parseTrustDisputeStatusInput(value: unknown): (typeof TRUST_DISPUTE_STATUS_DB)[number] | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "UNDER_REVIEW") return "IN_REVIEW";
  return (TRUST_DISPUTE_STATUS_DB as readonly string[]).includes(raw) ? (raw as any) : null;
}

export function parseOptionalStatus(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return parseReportStatus(value);
}

export function parseOptionalTrustDisputeStatus(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return parseTrustDisputeStatusInput(value);
}

export function parseAssignedAdminInput(value: unknown) {
  if (value === undefined || value === null) return { provided: false as const, value: null as string | null };
  const normalized = String(value ?? "").trim();
  if (!normalized) return { provided: true as const, value: null as string | null };
  return { provided: true as const, value: normalized.slice(0, 120) };
}

export function parseInternalNoteInput(value: unknown) {
  if (value === undefined) return { provided: false as const, value: null as string | null };
  const normalized = String(value ?? "").trim();
  return { provided: true as const, value: normalized ? normalized.slice(0, 2000) : null };
}

export function parseResolutionCodeInput(value: unknown) {
  if (value === undefined) return { provided: false as const, value: null as string | null };
  const normalized = String(value ?? "").trim().toUpperCase();
  return { provided: true as const, value: normalized ? normalized.slice(0, 64) : null };
}

export function presentTrustDisputeStatus(status: string): TrustPublicDisputeStatus {
  if (status === "IN_REVIEW") return "UNDER_REVIEW";
  if (status === "OPEN" || status === "RESOLVED" || status === "REJECTED") return status;
  return "OPEN";
}

export function serializeReport(record: any) {
  return {
    id: record.id,
    reporterId: record.reporterId,
    reportedId: record.reportedId,
    reporter: record.reporter
      ? {
          id: record.reporter.id,
          name: record.reporter.name ?? null,
        }
      : undefined,
    reported: record.reported
      ? {
          id: record.reported.id,
          name: record.reported.name ?? null,
        }
      : undefined,
    reason: record.reason,
    description: record.description ?? null,
    status: record.status,
    assignedAdminId: record.assignedAdminId ?? null,
    assignedAdmin: record.assignedAdmin
      ? {
          id: record.assignedAdmin.id,
          name: record.assignedAdmin.name ?? null,
        }
      : undefined,
    resolutionCode: record.resolutionCode ?? null,
    internalNote: record.internalNote ?? null,
    reviewedAt: record.reviewedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeTrustDispute(record: any) {
  return {
    id: record.id,
    userId: record.userId,
    user: record.user
      ? {
          id: record.user.id,
          name: record.user.name ?? null,
        }
      : undefined,
    orderId: record.orderId ?? null,
    vertical: record.vertical,
    reason: record.reason,
    description: record.description,
    status: presentTrustDisputeStatus(record.status),
    assignedAdminId: record.assignedAdminId ?? null,
    assignedAdmin: record.assignedAdmin
      ? {
          id: record.assignedAdmin.id,
          name: record.assignedAdmin.name ?? null,
        }
      : undefined,
    resolutionCode: record.resolutionCode ?? null,
    internalNote: record.internalNote ?? null,
    reviewedAt: record.reviewedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeBlock(record: any) {
  return {
    id: record.id,
    blockerId: record.blockerId,
    blockedId: record.blockedId,
    createdAt: record.createdAt,
    blockedUser: record.blocked
      ? {
          id: record.blocked.id,
          name: record.blocked.name ?? null,
        }
      : undefined,
  };
}

export function trustAudit(params: Parameters<typeof auditLog>[0]) {
  auditLog(params);
}

export { AuditReason, getCorrelationId };
