import { randomUUID } from "crypto";

type Actor = { userId?: string | null; role?: string | null; system?: true };

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
