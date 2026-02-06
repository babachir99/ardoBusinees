import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedRoles = new Set([
  "ADMIN",
  "SELLER",
  "CUSTOMER",
  "TRANSPORTER",
  "COURIER",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const role = body?.role ? String(body.role) : null;
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;

  if (role && !allowedRoles.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!role && isActive === null) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role ? { role } : {}),
      ...(isActive === null ? {} : { isActive }),
      activityLogs: {
        create: [
          {
            action: role ? "ROLE_UPDATED" : "ACCOUNT_UPDATED",
            metadata: role ? { role } : { isActive },
          },
        ],
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}
