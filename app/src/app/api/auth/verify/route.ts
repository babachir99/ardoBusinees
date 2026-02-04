import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").toLowerCase().trim();
  const token = String(body?.token ?? "");

  if (!email || !token) {
    return NextResponse.json(
      { error: "email and token are required" },
      { status: 400 }
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.identifier !== email || record.expires < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ ok: true });
}
