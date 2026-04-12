import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { syncUserLegacyRoleAssignments } from "@/lib/account-security";
import { assertSameOrigin } from "@/lib/request-security";

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
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

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

  const typedRole = role as UserRole | null;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(typedRole ? { role: typedRole } : {}),
        ...(isActive === null ? {} : { isActive }),
        activityLogs: {
          create: [
            {
              action: typedRole ? "ROLE_UPDATED" : "ACCOUNT_UPDATED",
              metadata: typedRole ? { role: typedRole } : { isActive },
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

    if (typedRole) {
      await syncUserLegacyRoleAssignments(tx, updated.id, typedRole);
    }

    return updated;
  });

  return NextResponse.json(user);
}
