import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const name = body.name ? String(body.name) : undefined;
  const phone = body.phone ? String(body.phone) : undefined;
  const image = body.image ? String(body.image) : undefined;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "User already exists" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      image,
      passwordHash,
      role: "CUSTOMER",
      activityLogs: {
        create: [{ action: "USER_REGISTER", metadata: { method: "email" } }],
      },
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, token },
    { status: 201 }
  );
}
