import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type OrderWithSeller = {
  id: string;
  userId: string;
  sellerId: string | null;
  totalCents: number;
  feesCents: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELED" | "FULFILLING" | "REFUNDED";
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

function normalizeProvider(value: unknown): string {
  if (typeof value !== "string") return "provider_pending";
  const normalized = value.trim().toLowerCase();
  return normalized || "provider_pending";
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

  const provider = normalizeProvider((body as { provider?: unknown } | null)?.provider);
  const returnUrl = typeof (body as { returnUrl?: unknown } | null)?.returnUrl === "string"
    ? ((body as { returnUrl?: string }).returnUrl as string)
    : null;
  const cancelUrl = typeof (body as { cancelUrl?: unknown } | null)?.cancelUrl === "string"
    ? ((body as { cancelUrl?: string }).cancelUrl as string)
    : null;

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

  const intentId = randomUUID();

  const initializedPayments = await prisma.$transaction(async (tx) => {
    const records: Array<{
      orderId: string;
      paymentId: string;
      providerRef: string | null;
      status: string;
      amountCents: number;
      currency: string;
    }> = [];

    for (const order of orders as OrderWithSeller[]) {
      const providerRef = `${provider}_${intentId}_${order.id}`;

      const payment = await tx.payment.upsert({
        where: { orderId: order.id },
        update: {
          provider,
          providerRef,
          amountCents: order.totalCents,
          currency: order.currency,
          status: "PENDING",
          method: order.paymentMethod ?? undefined,
          splitMeta: {
            mode: "provider-ready",
            intentId,
            returnUrl,
            cancelUrl,
          },
        },
        create: {
          orderId: order.id,
          provider,
          providerRef,
          amountCents: order.totalCents,
          currency: order.currency,
          status: "PENDING",
          method: order.paymentMethod ?? undefined,
          splitMeta: {
            mode: "provider-ready",
            intentId,
            returnUrl,
            cancelUrl,
          },
        },
      });

      if (order.paymentStatus !== "PENDING") {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "PENDING" },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: order.status,
          note: `Payment initialized (${provider})`,
        },
      });

      records.push({
        orderId: order.id,
        paymentId: payment.id,
        providerRef: payment.providerRef,
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
      });
    }

    return records;
  });

  return NextResponse.json(
    {
      success: true,
      intentId,
      provider,
      callbackUrl: "/api/payments/callback",
      redirectUrl: null,
      orderIds: initializedPayments.map((payment) => payment.orderId),
      payments: initializedPayments,
    },
    { status: 201 }
  );
}
