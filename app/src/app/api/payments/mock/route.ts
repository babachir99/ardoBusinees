import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type OrderWithSeller = {
  id: string;
  userId: string;
  sellerId: string | null;
  totalCents: number;
  shippingCents: number;
  feesCents: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELED";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paymentMethod: "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH" | null;
  seller: { userId: string } | null;
};

function getRequestedOrderIds(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const typedBody = body as { orderId?: unknown; orderIds?: unknown };
  const fromSingle = typeof typedBody.orderId === "string" ? [typedBody.orderId] : [];
  const fromMany = Array.isArray(typedBody.orderIds)
    ? typedBody.orderIds.filter((value): value is string => typeof value === "string")
    : [];

  return Array.from(new Set([...fromSingle, ...fromMany].map((value) => value.trim()).filter(Boolean)));
}

function canAccessOrder(order: OrderWithSeller, userId: string, role: string): boolean {
  if (role === "ADMIN") return true;
  if (order.userId === userId) return true;
  if (role === "SELLER" && order.seller?.userId === userId) return true;
  return false;
}

async function finalizeMockPayment(order: OrderWithSeller) {
  return prisma.$transaction(async (tx) => {
    const existingPayment = await tx.payment.findUnique({
      where: { orderId: order.id },
    });

    const payment = existingPayment
      ? await tx.payment.update({
          where: { orderId: order.id },
          data: {
            status: "PAID",
            method: order.paymentMethod ?? undefined,
          },
        })
      : await tx.payment.create({
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
      await tx.order.update({
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

    if (order.sellerId) {
      const existingPayout = await tx.payout.findFirst({
        where: { orderId: order.id, sellerId: order.sellerId },
        select: { id: true },
      });

      if (!existingPayout) {
        const payoutAmount = Math.max(order.totalCents - order.feesCents, 0);
        await tx.payout.create({
          data: {
            sellerId: order.sellerId,
            orderId: order.id,
            amountCents: payoutAmount,
            currency: order.currency,
            status: "PENDING",
          },
        });
      }
    }

    return payment;
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderIds = getRequestedOrderIds(body);

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "orderId or orderIds is required" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { seller: { select: { userId: true } } },
  });

  if (orders.length !== orderIds.length) {
    return NextResponse.json({ error: "One or more orders were not found" }, { status: 404 });
  }

  const forbiddenOrder = orders.find(
    (order) => !canAccessOrder(order as OrderWithSeller, session.user.id, session.user.role)
  );

  if (forbiddenOrder) {
    return NextResponse.json({ error: `Forbidden for order ${forbiddenOrder.id}` }, { status: 403 });
  }

  const results = [];
  for (const order of orders) {
    const payment = await finalizeMockPayment(order as OrderWithSeller);
    results.push({ orderId: order.id, payment });
  }

  if (results.length === 1) {
    return NextResponse.json(results[0].payment, { status: 201 });
  }

  return NextResponse.json(
    {
      success: true,
      orderIds: results.map((result) => result.orderId),
      payments: results.map((result) => result.payment),
    },
    { status: 201 }
  );
}
