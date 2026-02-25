import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, resolveClientIp } from "@/lib/rate-limit";

function normalizeIdentifier(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed || null;
}

function tooManyResponse(retryAfterSeconds: number, scope: string) {
  return NextResponse.json(
    {
      error: "RATE_LIMITED",
      message: `Too many requests (${scope}). Please retry later.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export function assertAuthRateLimit(
  request: NextRequest,
  options: {
    routeKey: string;
    identifier?: string | null;
    ipLimit?: number;
    identifierLimit?: number;
    windowMs?: number;
  }
) {
  const routeKey = options.routeKey;
  const windowMs = options.windowMs ?? 10 * 60 * 1000;
  const ipLimit = options.ipLimit ?? 20;
  const identifierLimit = options.identifierLimit ?? 8;
  const ip = resolveClientIp(request);

  const ipRate = checkRateLimit({ key: `auth:${routeKey}:ip:${ip}`, limit: ipLimit, windowMs });
  if (!ipRate.allowed) {
    return tooManyResponse(ipRate.retryAfterSeconds, "ip");
  }

  const identifier = normalizeIdentifier(options.identifier);
  if (identifier) {
    const idRate = checkRateLimit({
      key: `auth:${routeKey}:id:${identifier}`,
      limit: identifierLimit,
      windowMs,
    });
    if (!idRate.allowed) {
      return tooManyResponse(idRate.retryAfterSeconds, "identifier");
    }
  }

  return null;
}
