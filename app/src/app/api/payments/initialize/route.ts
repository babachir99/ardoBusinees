import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PaymentLedgerContextType, PaymentLedgerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const PLATFORM_FEE_BPS = 1000;

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

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function hasPaymentLedgerDelegate() {
  const runtimePrisma = prisma as unknown as { paymentLedger?: unknown };
  return Boolean(runtimePrisma.paymentLedger);
}

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
  if (!hasPaymentLedgerDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Payment ledger delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const body = await request.json().catch(() => null);
  const orderIds = getRequestedOrderIds(body);

  if (orderIds.length === 0) {
    return errorResponse(400, "INVALID_INPUT", "orderId or orderIds is required.");
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
    return errorResponse(404, "ORDER_NOT_FOUND", "One or more orders were not found.");
  }

  const forbiddenOrder = orders.find(
    (order) => !canAccessOrder(order as OrderWithSeller, session.user.id, session.user.role)
  );

  if (forbiddenOrder) {
    return errorResponse(403, "FORBIDDEN", `Forbidden for order ${forbiddenOrder.id}.`);
  }

  const paidOrder = orders.find((order) => order.paymentStatus === "PAID");
  if (paidOrder) {
    return errorResponse(409, "ORDER_ALREADY_PAID", `Order ${paidOrder.id} is already paid.`);
  }

  const nonPendingOrder = orders.find((order) => order.paymentStatus !== "PENDING");
  if (nonPendingOrder) {
    return errorResponse(
      409,
      "ORDER_NOT_PENDING",
      `Order ${nonPendingOrder.id} payment must be PENDING for initialization.`
    );
  }

  const intentId = randomUUID();
  const providerNormalized = provider.toUpperCase();

  try {
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

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            status: order.status,
            note: `Payment initialized (${provider})`,
          },
        });

        const [prestaBooking, tiakDelivery] = await Promise.all([
          tx.prestaBooking.findUnique({
            where: { orderId: order.id },
            select: { id: true },
          }),
          tx.tiakDelivery.findFirst({
            where: { orderId: order.id },
            select: { id: true },
          }),
        ]);

        const contextType = prestaBooking
          ? PaymentLedgerContextType.PRESTA_BOOKING
          : tiakDelivery
            ? PaymentLedgerContextType.TIAK_DELIVERY
            : PaymentLedgerContextType.SHOP_ORDER;
        const contextId = prestaBooking?.id ?? tiakDelivery?.id ?? order.id;

        const platformFeeCents = Math.round((order.totalCents * PLATFORM_FEE_BPS) / 10000);
        const payoutCents = order.totalCents - platformFeeCents;
        const providerIntentId = orderIds.length === 1 ? intentId : `${intentId}_${order.id}`;

        await tx.paymentLedger.upsert({
          where: {
            contextType_contextId: {
              contextType,
              contextId,
            },
          },
          update: {
            provider: providerNormalized,
            providerIntentId,
            orderId: order.id,
            amountTotalCents: order.totalCents,
            platformFeeCents,
            payoutCents,
            currency: order.currency,
            status: PaymentLedgerStatus.INITIATED,
          },
          create: {
            provider: providerNormalized,
            providerIntentId,
            orderId: order.id,
            contextType,
            contextId,
            amountTotalCents: order.totalCents,
            platformFeeCents,
            payoutCents,
            currency: order.currency,
            status: PaymentLedgerStatus.INITIATED,
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
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
