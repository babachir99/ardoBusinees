import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DisputeStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isVertical } from "@/lib/verticals";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusRaw = normalizeString(searchParams.get("status")).toUpperCase();
  const verticalRaw = normalizeString(searchParams.get("vertical")).toUpperCase();

  const where: Prisma.DisputeWhereInput = {};

  if (statusRaw) {
    if (!Object.values(DisputeStatus).includes(statusRaw as DisputeStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    where.status = statusRaw as DisputeStatus;
  }

  if (verticalRaw) {
    if (!isVertical(verticalRaw)) {
      return NextResponse.json({ error: "Invalid vertical" }, { status: 400 });
    }
    where.vertical = verticalRaw;
  }

  const disputes = await prisma.dispute.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      vertical: true,
      referenceId: true,
      reason: true,
      status: true,
      openedById: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      openedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(disputes);
}
