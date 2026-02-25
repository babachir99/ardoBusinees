import { createHash } from "crypto";
import { NextResponse } from "next/server";

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function allowInsecureInternalCalls() {
  const vercelEnv = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  const hostedNonLocal = vercelEnv === "preview" || vercelEnv === "staging";
  if (isProduction() || hostedNonLocal) return false;
  return process.env.ALLOW_INSECURE_INTERNAL_CALLS === "1";
}

function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHostHeaderValue(rawHost: string): string {
  const firstValue = rawHost.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!firstValue) return "";
  if (firstValue.startsWith("[")) {
    const endBracket = firstValue.indexOf("]");
    return endBracket > 0 ? firstValue.slice(1, endBracket) : firstValue;
  }
  const colonCount = (firstValue.match(/:/g) ?? []).length;
  if (colonCount === 1) return firstValue.split(":")[0] ?? firstValue;
  return firstValue;
}

export function shouldEchoAuthDebugTokens() {
  return !isProduction() && process.env.AUTH_DEBUG_TOKENS === "1";
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function assertAllowedHost(request: Request) {
  if (!isProduction()) return null;

  const allowedHosts = parseCsvEnv(process.env.ALLOWED_HOSTS);
  if (allowedHosts.length === 0) {
    return NextResponse.json(
      { error: "SECURITY_ENV_MISSING", message: "ALLOWED_HOSTS must be configured in production." },
      { status: 500 }
    );
  }

  const host = request.headers.get("x-forwarded-host")?.trim() || request.headers.get("host")?.trim() || "";
  if (!host) {
    return NextResponse.json({ error: "INVALID_HOST", message: "Host header required." }, { status: 400 });
  }

  const normalizedHost = normalizeHostHeaderValue(host);
  if (!allowedHosts.includes(normalizedHost)) {
    return NextResponse.json({ error: "INVALID_HOST", message: "Host not allowed." }, { status: 400 });
  }

  return null;
}

function getExpectedOrigins(): string[] {
  const values = [process.env.PUBLIC_APP_ORIGIN, process.env.BASE_URL, process.env.NEXTAUTH_URL]
    .flatMap((value) => String(value ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);

  const normalized = new Set<string>();
  for (const value of values) {
    try {
      normalized.add(new URL(value).origin);
    } catch {
      // ignore invalid env value
    }
  }
  return [...normalized];
}

export function assertSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;

  const expectedOrigins = getExpectedOrigins();
  if (expectedOrigins.length === 0) {
    if (isProduction()) {
      return NextResponse.json(
        { error: "SECURITY_ENV_MISSING", message: "PUBLIC_APP_ORIGIN/BASE_URL/NEXTAUTH_URL must be configured in production." },
        { status: 500 }
      );
    }
    return null;
  }

  const originHeader = request.headers.get("origin")?.trim();
  const refererHeader = request.headers.get("referer")?.trim();

  let requestOrigin = "";
  if (originHeader) {
    requestOrigin = originHeader;
  } else if (refererHeader) {
    try {
      requestOrigin = new URL(refererHeader).origin;
    } catch {
      requestOrigin = "";
    }
  }

  if (!requestOrigin) {
    if (isProduction()) {
      return NextResponse.json(
        { error: "CSRF_ORIGIN_REQUIRED", message: "Origin or Referer header required." },
        { status: 403 }
      );
    }
    return null;
  }

  if (!expectedOrigins.includes(requestOrigin)) {
    return NextResponse.json(
      { error: "CSRF_ORIGIN_MISMATCH", message: "Cross-origin request blocked." },
      { status: 403 }
    );
  }

  return null;
}

export function getTrustedInternalApiUrl(pathname: string) {
  const base = process.env.INTERNAL_BASE_URL || process.env.BASE_URL || process.env.NEXTAUTH_URL;
  if (!base) {
    throw new Error("INTERNAL_BASE_URL_MISSING");
  }
  return new URL(pathname, base);
}
