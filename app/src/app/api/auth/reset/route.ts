import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { getMinPasswordLength, validatePassword } from "@/lib/account-security";
import { assertAuthRateLimit } from "@/lib/auth-rate-limit";
import { sha256Hex } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").toLowerCase().trim();
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");
  const rateLimited = await assertAuthRateLimit(request, { routeKey: "reset", identifier: email || null, ipLimit: 15, identifierLimit: 8, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  if (!email || !token || !password) {
    return NextResponse.json(
      { error: "email, token and password are required" },
      { status: 400 }
    );
  }

  const passwordValidation = validatePassword(password);
  if (passwordValidation) {
    return NextResponse.json(
      {
        error: `Password must contain at least ${getMinPasswordLength()} characters.`,
      },
      { status: 400 }
    );
  }

  const tokenHash = sha256Hex(token);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

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

  const passwordHash = await hash(password, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
    },
  });

  return NextResponse.json({ ok: true });
}
