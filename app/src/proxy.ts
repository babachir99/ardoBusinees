import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { assertSameOrigin } from "@/lib/request-security";

const intlMiddleware = createMiddleware(routing);
const API_CSRF_SKIP_PREFIXES = ["/api/auth/", "/api/payments/", "/api/cron/"];

function normalizeApiPathname(pathname: string) {
  return pathname.replace(/^\/[a-z]{2}(?=\/api\/)/i, "");
}

function shouldSkipApiCsrf(pathname: string) {
  return API_CSRF_SKIP_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
  );
}

export default function proxy(request: NextRequest) {
  const normalizedPathname = normalizeApiPathname(request.nextUrl.pathname);

  if (normalizedPathname.startsWith("/api/")) {
    if (!shouldSkipApiCsrf(normalizedPathname)) {
      const csrfBlocked = assertSameOrigin(request);
      if (csrfBlocked) {
        return csrfBlocked;
      }
    }

    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
