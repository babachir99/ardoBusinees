import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertAuthRateLimit } from "@/lib/auth-rate-limit";
import { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

function extractCredentialEmail(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get("content-type") || "";
  return request
    .clone()
    .text()
    .then((raw) => {
      if (!raw) return null;
      if (contentType.includes("application/json")) {
        try {
          const body = JSON.parse(raw);
          return typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
        } catch {
          return null;
        }
      }
      const params = new URLSearchParams(raw);
      const email = params.get("email") || params.get("username");
      return email ? email.trim().toLowerCase() : null;
    })
    .catch(() => null);
}

export const GET = handler;

export async function POST(request: NextRequest, context: Parameters<typeof handler>[1]) {
  const isCredentialsCallback = request.nextUrl.pathname.endsWith("/api/auth/callback/credentials");
  if (isCredentialsCallback) {
    const email = await extractCredentialEmail(request);
    const rateLimited = assertAuthRateLimit(request, {
      routeKey: "login",
      identifier: email,
      ipLimit: 15,
      identifierLimit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }
  }

  return handler(request, context);
}
