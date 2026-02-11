import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: String(body.orderId) },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { orderId: order.id },
  });

  const payment = existingPayment
    ? await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: "PAID",
          method: order.paymentMethod ?? undefined,
        },
      })
    : await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "paydunya_mock",
          amountCents: order.totalCents,
          currency: order.currency,
          status: "PAID",
          method: order.paymentMethod ?? undefined,
          splitMeta: { mode: "mock" },
        },
      });

  const needsOrderUpdate = order.paymentStatus !== "PAID" || order.status !== "CONFIRMED";

  if (needsOrderUpdate) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        events: {
          create: [
            {
              status: "CONFIRMED",
              note: "Payment confirmed (mock)",
            },
          ],
        },
      },
    });
  }

  return NextResponse.json(payment, { status: 201 });
}


