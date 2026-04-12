import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitAdRequest } from "@/lib/adRequests";
import {
  checkRateLimitAsync,
  getRateLimitHeaders,
  resolveClientIp,
} from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

  const session = await getServerSession(authOptions);
  const body = await request.json().catch(() => null);
  const email =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  const ip = resolveClientIp(request);
  const [ipRate, emailRate] = await Promise.all([
    checkRateLimitAsync({
      key: `ad-requests:ip:${ip}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    }),
    email
      ? checkRateLimitAsync({
          key: `ad-requests:email:${email}`,
          limit: 3,
          windowMs: 15 * 60 * 1000,
        })
      : Promise.resolve(null),
  ]);

  const blocked = !ipRate.allowed ? ipRate : emailRate && !emailRate.allowed ? emailRate : null;
  if (blocked) {
    return NextResponse.json(
      { error: "Too many ad requests. Please wait before submitting another one." },
      { status: 429, headers: getRateLimitHeaders(blocked) }
    );
  }

  try {
    const requestId = await submitAdRequest(body ?? {}, session?.user?.id);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AD_REQUEST") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to submit ad request" }, { status: 500 });
  }
}
