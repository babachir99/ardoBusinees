import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, PayoutStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set(Object.values(PayoutStatus));

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const statusRaw = normalizeOptionalString(body?.status);
  const hasProviderRef = Object.prototype.hasOwnProperty.call(body ?? {}, "providerRef");
  const providerRef = hasProviderRef
    ? normalizeOptionalString(body?.providerRef) ?? null
    : undefined;

  const status = statusRaw ? statusRaw.toUpperCase() : undefined;

  if (status && !allowedStatuses.has(status as PayoutStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (status === undefined && providerRef === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.payout.update({
      where: { id },
      data: {
        ...(status ? { status: status as PayoutStatus } : {}),
        ...(providerRef !== undefined ? { providerRef } : {}),
      },
      select: {
        id: true,
        status: true,
        providerRef: true,
        amountCents: true,
        currency: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    throw error;
  }
}
