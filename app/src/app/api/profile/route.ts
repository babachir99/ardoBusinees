import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRoles } from "@/lib/userRoles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const roles = await getUserRoles(user.id).catch(() => []);
  return NextResponse.json({
    ...user,
    roles,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name ? String(body.name) : undefined;
  const phone = body.phone ? String(body.phone) : undefined;
  const image = body.image ? String(body.image) : undefined;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone,
      image,
      activityLogs: {
        create: [{ action: "PROFILE_UPDATED" }],
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  const roles = await getUserRoles(user.id).catch(() => []);
  return NextResponse.json({
    ...user,
    roles,
  });
}
