import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimitAsync,
  getRateLimitHeaders,
  resolveClientIp,
} from "@/lib/rate-limit";

type RateLimitScope = {
  prefix: string;
  id?: string | null;
  limit?: number | null;
};

function normalizeScopeId(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

export async function assertActionRateLimit(
  request: NextRequest,
  options: {
    routeKey: string;
    label: string;
    windowMs?: number;
    ipLimit?: number;
    scopes?: RateLimitScope[];
  }
) {
  const checks: Array<{ key: string; limit: number }> = [];
  const routeKey = options.routeKey.trim();
  const label = options.label.trim() || "requests";
  const windowMs = options.windowMs ?? 10 * 60 * 1000;

  if (options.ipLimit && options.ipLimit > 0) {
    checks.push({
      key: `action:${routeKey}:ip:${resolveClientIp(request)}`,
      limit: options.ipLimit,
    });
  }

  for (const scope of options.scopes ?? []) {
    const scopeId = normalizeScopeId(scope.id);
    if (!scopeId || !scope.limit || scope.limit <= 0) {
      continue;
    }
    checks.push({
      key: `action:${routeKey}:${scope.prefix}:${scopeId}`,
      limit: scope.limit,
    });
  }

  for (const check of checks) {
    const result = await checkRateLimitAsync({
      key: check.key,
      limit: check.limit,
      windowMs,
    });
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: `Too many ${label}. Please retry later.`,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(result),
        }
      );
    }
  }

  return null;
}
