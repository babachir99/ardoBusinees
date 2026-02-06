import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const allowedRoles = new Set([
  "ADMIN",
  "SELLER",
  "CUSTOMER",
  "TRANSPORTER",
  "COURIER",
]);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;
  const roleRaw = searchParams.get("role") ?? undefined;

  if (roleRaw && !allowedRoles.has(roleRaw.toUpperCase())) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const role = roleRaw ? (roleRaw.toUpperCase() as UserRole) : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(email ? { email: { contains: email, mode: "insensitive" } } : {}),
      ...(role ? { role } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}
