import { NextRequest, NextResponse } from "next/server";
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const status = String(body.status).toUpperCase();
  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
    data: {
      status,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
