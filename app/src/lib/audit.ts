import { randomUUID } from "crypto";

type Actor = { userId?: string | null; role?: string | null; system?: true };

export const AuditReason = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_INPUT: "INVALID_INPUT",
  STATE_CONFLICT: "STATE_CONFLICT",
  NOT_FOUND: "NOT_FOUND",
  ACTIVE_DISPUTE: "ACTIVE_DISPUTE",
  ASSIGNMENT_EXPIRED: "ASSIGNMENT_EXPIRED",
  LEDGER_MISSING: "LEDGER_MISSING",
  LEDGER_STATE_INVALID: "LEDGER_STATE_INVALID",
  PAYMENT_ALREADY_PAID: "PAYMENT_ALREADY_PAID",
  DUPLICATE_EVENT: "DUPLICATE_EVENT",
  DB_ERROR: "DB_ERROR",
  SUCCESS: "SUCCESS",
} as const;

export function getCorrelationId(request: Request) {
  const existing = request.headers.get("x-correlation-id")?.trim();
  return existing || randomUUID();
}

export function withCorrelationId<T extends Response>(response: T, correlationId: string): T {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export function auditLog(params: {
  correlationId: string;
  actor: Actor;
  action: string;
  entity: { type: string; id?: string | null };
  outcome: "SUCCESS" | "DENIED" | "CONFLICT" | "ERROR";
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      ...params,
    })
  );
}
