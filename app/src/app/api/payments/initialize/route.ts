import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PaymentLedgerContextType, PaymentLedgerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertAllowedHost, assertSameOrigin } from "@/lib/request-security";

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

function isProductionEnv() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function hasValidInternalApiToken(request: NextRequest) {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("x-internal-api-token")?.trim();
  return Boolean(provided && provided === expected);
}

function isMarkedInternalRequest(request: NextRequest) {
  return request.headers.get("x-internal-request")?.trim() === "1";
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "payments.initialize";

  const hostBlocked = assertAllowedHost(request);
  if (hostBlocked) return respond(hostBlocked);
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return respond(csrfBlocked);

  try {
    if (!hasPaymentLedgerDelegate()) {
      auditLog({
        correlationId,
        actor: { system: true },
        action,
        entity: { type: "PaymentLedger" },
        outcome: "ERROR",
        reason: AuditReason.DB_ERROR,
      });
      return respond(
        errorResponse(
          503,
          "DELEGATE_UNAVAILABLE",
          "Payment ledger delegate unavailable. Run npx prisma generate and restart dev server."
        )
      );
    }

    const session = await getServerSession(authOptions);
    const internalMarked = isMarkedInternalRequest(request);
    const internalTokenValid = hasValidInternalApiToken(request);
    const internalAccessAllowed =
      internalMarked && (internalTokenValid || !isProductionEnv());

    if (internalMarked && isProductionEnv() && !internalTokenValid) {
      auditLog({
        correlationId,
        actor: { system: true },
        action,
        entity: { type: "Order" },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
        metadata: { internalMarked: true, tokenValid: false },
      });
      return respond(errorResponse(403, "FORBIDDEN", "Invalid internal token."));
    }

    if (!session && !internalAccessAllowed) {
      auditLog({
        correlationId,
        actor: { system: true },
        action,
        entity: { type: "Order" },
        outcome: "DENIED",
        reason: AuditReason.UNAUTHORIZED,
        metadata: { internalMarked },
      });
      return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
    }

    const actor = session
      ? { userId: session.user.id, role: session.user.role }
      : ({ system: true as const });

    const body = await request.json().catch(() => null);
    const orderIds = getRequestedOrderIds(body);

    if (orderIds.length === 0) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Order" },
        outcome: "CONFLICT",
        reason: AuditReason.INVALID_INPUT,
      });
      return respond(errorResponse(400, "INVALID_INPUT", "orderId or orderIds is required."));
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
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Order" },
        outcome: "CONFLICT",
        reason: AuditReason.NOT_FOUND,
        metadata: { requestedCount: orderIds.length, foundCount: orders.length },
      });
      return respond(errorResponse(404, "ORDER_NOT_FOUND", "One or more orders were not found."));
    }

    const forbiddenOrder = session
      ? orders.find(
          (order) => !canAccessOrder(order as OrderWithSeller, session.user.id, session.user.role)
        )
      : null;

    if (forbiddenOrder) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Order", id: forbiddenOrder.id },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
      });
      return respond(errorResponse(403, "FORBIDDEN", `Forbidden for order ${forbiddenOrder.id}.`));
    }

    const paidOrder = orders.find((order) => order.paymentStatus === "PAID");
    if (paidOrder) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Order", id: paidOrder.id },
        outcome: "CONFLICT",
        reason: AuditReason.PAYMENT_ALREADY_PAID,
      });
      return respond(errorResponse(409, "ORDER_ALREADY_PAID", `Order ${paidOrder.id} is already paid.`));
    }

    const nonPendingOrder = orders.find((order) => order.paymentStatus !== "PENDING");
    if (nonPendingOrder) {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "Order", id: nonPendingOrder.id },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
      });
      return respond(
        errorResponse(
          409,
          "ORDER_NOT_PENDING",
          `Order ${nonPendingOrder.id} payment must be PENDING for initialization.`
        )
      );
    }

    const intentId = randomUUID();
    const providerNormalized = provider.toUpperCase();

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

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger", id: intentId },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        orderCount: initializedPayments.length,
        amountTotalCents: initializedPayments.reduce((sum, item) => sum + item.amountCents, 0),
        currency: initializedPayments[0]?.currency ?? null,
      },
    });

    return respond(
      NextResponse.json(
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
      )
    );
  } catch {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "PaymentLedger" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
