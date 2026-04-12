import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { assertAuthRateLimit } from "@/lib/auth-rate-limit";
import { buildAuthTokenIdentifier, getAuthTokenPurgeIdentifiers } from "@/lib/auth-tokens";
import { assertSameOrigin, sha256Hex, shouldEchoAuthDebugTokens } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const sameOriginError = assertSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").toLowerCase().trim();
  const rateLimited = await assertAuthRateLimit(request, {
    routeKey: "forgot",
    identifier: email || null,
    ipLimit: 10,
    identifierLimit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimited) {
    return rateLimited;
  }
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const expires = new Date(Date.now() + 1000 * 60 * 30);

  const tokenIdentifier = buildAuthTokenIdentifier("reset", email);

  await prisma.verificationToken.deleteMany({
    where: { identifier: { in: getAuthTokenPurgeIdentifiers("reset", email) } },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: tokenIdentifier,
      token: tokenHash,
      expires,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
    },
  });

  return NextResponse.json(shouldEchoAuthDebugTokens() ? { ok: true, token } : { ok: true });
}
