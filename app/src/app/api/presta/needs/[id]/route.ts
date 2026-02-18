import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ownerAllowedStatuses = new Set(["CLOSED", "CANCELED"]);
const adminAllowedStatuses = new Set(["IN_REVIEW", "ACCEPTED", "CLOSED", "CANCELED"]);

function hasPrestaNeedDelegate() {
  const runtimePrisma = prisma as unknown as { prestaNeed?: unknown };
  return Boolean(runtimePrisma.prestaNeed);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasPrestaNeedDelegate()) {
    return NextResponse.json(
      { error: "PRESTA needs delegate unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const { id } = await params;

  const need = await prisma.prestaNeed.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      storeId: true,
      title: true,
      description: true,
      city: true,
      area: true,
      budgetCents: true,
      currency: true,
      preferredDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  if (!need) {
    return NextResponse.json({ error: "Need not found" }, { status: 404 });
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const isOwner = session?.user?.id === need.customerId;
  if (need.status !== "OPEN" && !isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(need);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasPrestaNeedDelegate()) {
    return NextResponse.json(
      { error: "PRESTA needs delegate unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.prestaNeed.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      status: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Need not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const nextStatus = normalizeString((body as { status?: unknown })?.status).toUpperCase();
  if (!nextStatus) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = session.user.id === existing.customerId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isOwner && !ownerAllowedStatuses.has(nextStatus)) {
    return NextResponse.json({ error: "Owner can only close or cancel" }, { status: 400 });
  }

  if (isAdmin && !adminAllowedStatuses.has(nextStatus)) {
    return NextResponse.json({ error: "Invalid admin status transition" }, { status: 400 });
  }

  const updated = await prisma.prestaNeed.update({
    where: { id: existing.id },
    data: { status: nextStatus as "OPEN" | "IN_REVIEW" | "ACCEPTED" | "CLOSED" | "CANCELED" },
    select: {
      id: true,
      customerId: true,
      storeId: true,
      title: true,
      description: true,
      city: true,
      area: true,
      budgetCents: true,
      currency: true,
      preferredDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  return NextResponse.json(updated);
}
