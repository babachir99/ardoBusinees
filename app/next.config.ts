import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const vercelEnv = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase();
const isProduction = process.env.NODE_ENV === "production" || vercelEnv === "production";
const isHostedNonLocal = vercelEnv === "preview" || vercelEnv === "staging";
type CspMode = "off" | "report-only" | "enforce";

function resolveCspMode(): CspMode {
  const raw = String(process.env.CSP_MODE ?? "").trim().toLowerCase();
  if (raw === "off") return "off";
  if (raw === "enforce") return "enforce";
  if (raw === "report-only" || raw === "reportonly" || raw === "report_only") {
    return "report-only";
  }

  return isProduction || isHostedNonLocal ? "report-only" : "off";
}

function buildCspValue() {
  const reportUri = String(process.env.CSP_REPORT_URI ?? "").trim();
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = ["'self'", "'unsafe-inline'", "https:"];

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https:",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: ws: wss:",
    "frame-src 'self' https:",
    "media-src 'self' data: blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

function assertStartupSecurityEnv() {
  if (!(isProduction || isHostedNonLocal)) return;

  const required = ["ALLOWED_HOSTS", "PUBLIC_APP_ORIGIN", "INTERNAL_BASE_URL", "INTERNAL_API_TOKEN"] as const;
  const missing = required.filter((key) => !String(process.env[key] ?? "").trim());

  if (missing.length > 0) {
    throw new Error(`[security-config] Missing required env(s): ${missing.join(", ")}`);
  }

  if (String(process.env.ALLOW_INSECURE_INTERNAL_CALLS ?? "").trim() === "1") {
    throw new Error("[security-config] ALLOW_INSECURE_INTERNAL_CALLS must not be enabled in production/preview/staging");
  }
}

assertStartupSecurityEnv();

const cspMode = resolveCspMode();
const cspValue = buildCspValue();

const nextConfig: NextConfig = {
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(cspMode === "enforce"
        ? [{ key: "Content-Security-Policy", value: cspValue }]
        : cspMode === "report-only"
          ? [{ key: "Content-Security-Policy-Report-Only", value: cspValue }]
          : []),
      ...(isProduction
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
        : []),
    ];

    return [
      {
        source: "/:path*",
        headers,
      },
      {
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "private, max-age=0, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
