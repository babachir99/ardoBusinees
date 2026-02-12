import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PayoutStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set(Object.values(PayoutStatus));

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const idsRaw: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
  const ids = idsRaw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const statusRaw = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "";
  const status = statusRaw as PayoutStatus;

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await prisma.payout.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return NextResponse.json({ ok: true, updatedCount: result.count });
}

