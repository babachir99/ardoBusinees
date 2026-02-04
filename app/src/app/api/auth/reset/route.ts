import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").toLowerCase().trim();
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (!email || !token || !password) {
    return NextResponse.json(
      { error: "email, token and password are required" },
      { status: 400 }
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.identifier !== email || record.expires < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  await prisma.verificationToken.delete({ where: { token } });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
    },
  });

  return NextResponse.json({ ok: true });
}
