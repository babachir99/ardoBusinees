import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PayoutStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/request-security";

const allowedStatuses = new Set<PayoutStatus>(["HOLD", "FAILED"]);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

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
    return NextResponse.json(
      { error: "Bulk payout updates only support HOLD or FAILED" },
      { status: 400 }
    );
  }

  const currentPayouts = await prisma.payout.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
    },
  });

  const allowedCurrentStatuses =
    status === "HOLD"
      ? (["PENDING", "FAILED"] as PayoutStatus[])
      : (["PENDING", "HOLD"] as PayoutStatus[]);

  const eligibleIds = currentPayouts
    .filter((payout) => allowedCurrentStatuses.includes(payout.status))
    .map((payout) => payout.id);

  const result =
    eligibleIds.length > 0
      ? await prisma.payout.updateMany({
          where: { id: { in: eligibleIds } },
          data: { status },
        })
      : { count: 0 };

  return NextResponse.json({
    ok: true,
    updatedCount: result.count,
    skippedCount: ids.length - result.count,
  });
}
