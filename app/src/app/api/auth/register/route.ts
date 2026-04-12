import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { getMinPasswordLength, validatePassword } from "@/lib/account-security";
import { buildAuthTokenIdentifier, getAuthTokenPurgeIdentifiers } from "@/lib/auth-tokens";
import { mapLegacyRoleToUserRoleType } from "@/lib/userRoles";
import { assertAuthRateLimit } from "@/lib/auth-rate-limit";
import { assertSameOrigin, sha256Hex, shouldEchoAuthDebugTokens } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const sameOriginError = assertSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  const rateLimited = await assertAuthRateLimit(request, { routeKey: "register", identifier: email || null, ipLimit: 10, identifierLimit: 5, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;
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

  const passwordValidation = validatePassword(password);
  if (passwordValidation) {
    return NextResponse.json(
      {
        error: `Password must contain at least ${getMinPasswordLength()} characters.`,
      },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Unable to create account" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60);

  const roleType = mapLegacyRoleToUserRoleType("CUSTOMER");

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

  await prisma.userRoleAssignment
    .upsert({
      where: {
        userId_role: {
          userId: user.id,
          role: roleType,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        userId: user.id,
        role: roleType,
        status: "ACTIVE",
      },
    })
    .catch(() => null);

  const tokenIdentifier = buildAuthTokenIdentifier("verify", email);

  await prisma.verificationToken.deleteMany({
    where: { identifier: { in: getAuthTokenPurgeIdentifiers("verify", email) } },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: tokenIdentifier,
      token: tokenHash,
      expires,
    },
  });

  return NextResponse.json(
    shouldEchoAuthDebugTokens()
      ? { id: user.id, email: user.email, token }
      : { id: user.id, email: user.email },
    { status: 201 }
  );
}
