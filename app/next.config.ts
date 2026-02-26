import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const vercelEnv = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase();
const isProduction = process.env.NODE_ENV === "production" || vercelEnv === "production";
const isHostedNonLocal = vercelEnv === "preview" || vercelEnv === "staging";

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

const nextConfig: NextConfig = {
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy-Report-Only",
        value: "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      },
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
