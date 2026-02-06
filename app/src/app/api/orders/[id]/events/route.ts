import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set([
  "PENDING",
  "CONFIRMED",
  "FULFILLING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "REFUNDED",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = String(body.status ?? "").toUpperCase();
  if (!allowedStatuses.has(status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, sellerId: true, userId: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!seller || seller.id !== order.sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const event = await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      status,
      note: body.note ?? undefined,
      proofUrl: body.proofUrl ?? undefined,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "ORDER_STATUS_UPDATED",
      entityType: "Order",
      entityId: order.id,
      metadata: { status },
    },
  });

  return NextResponse.json(event, { status: 201 });
}
