import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAuthRateLimit } from "@/lib/auth-rate-limit";
import { sha256Hex } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").toLowerCase().trim();
  const token = String(body?.token ?? "");
  const rateLimited = assertAuthRateLimit(request, { routeKey: "verify", identifier: email || null, ipLimit: 20, identifierLimit: 10, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  if (!email || !token) {
    return NextResponse.json(
      { error: "email and token are required" },
      { status: 400 }
    );
  }

  const tokenHash = sha256Hex(token);
  const now = new Date();

  const consumed = await prisma.verificationToken.deleteMany({
    where: {
      identifier: email,
      token: tokenHash,
      expires: { gt: now },
    },
  });

  if (consumed.count === 0) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ ok: true });
}
