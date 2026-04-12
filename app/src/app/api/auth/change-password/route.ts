import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare, hash } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/account-security";
import { assertAuthRateLimit } from "@/lib/auth-rate-limit";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const sameOriginError = assertSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const rateLimited = await assertAuthRateLimit(request, {
    routeKey: "change-password",
    identifier: user.email,
    ipLimit: 20,
    identifierLimit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const currentPassword = String((body as { currentPassword?: unknown })?.currentPassword ?? "");
  const newPassword = String((body as { newPassword?: unknown })?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const passwordValidation = validatePassword(newPassword);
  if (passwordValidation) {
    return NextResponse.json({ error: passwordValidation.code }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "PASSWORD_SAME_AS_CURRENT" }, { status: 400 });
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "PASSWORD_CHANGE_NOT_AVAILABLE" }, { status: 400 });
  }

  const validCurrent = await compare(currentPassword, user.passwordHash);
  if (!validCurrent) {
    return NextResponse.json({ error: "INVALID_CURRENT_PASSWORD" }, { status: 400 });
  }

  const newHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_CHANGED",
    },
  });

  return NextResponse.json({ ok: true });
}
