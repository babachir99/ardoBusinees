import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentLedgerStatus, PaymentStatus, PrestaBookingStatus } from "@prisma/client";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertAllowedHost, assertSameOrigin } from "@/lib/request-security";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { groupLocalItemsByProduct, incrementLocalProductStock } from "@/lib/order-stock";

function normalizeCallbackStatus(value: unknown): "PAID" | "FAILED" | null {
  const status = String(value ?? "").trim().toUpperCase();

  if (["PAID", "SUCCESS", "SUCCEEDED", "COMPLETED", "OK"].includes(status)) {
    return "PAID";
  }

  if (["FAILED", "FAIL", "ERROR", "CANCELED", "CANCELLED"].includes(status)) {
    return "FAILED";
  }

  return null;
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "payments.callback";

  const hostBlocked = assertAllowedHost(request);
  if (hostBlocked) return respond(hostBlocked);

  const session = await getServerSession(authOptions);
  const callbackToken = request.headers.get("x-payments-callback-token");
  const expectedToken = process.env.PAYMENTS_CALLBACK_TOKEN;

  const hasTokenAccess = Boolean(expectedToken && callbackToken === expectedToken);
  const isAdmin = session?.user?.role === "ADMIN";
  const vercelEnv = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  const isHostedNonLocal = vercelEnv === "preview" || vercelEnv === "staging";
  const isProduction = process.env.NODE_ENV === "production" || vercelEnv === "production";
  const isProductionLikeHosted = isProduction || isHostedNonLocal;
  const actor = isAdmin
    ? { userId: session?.user?.id ?? null, role: session?.user?.role ?? null }
    : { system: true as const };

  if (isAdmin) {
    const csrfBlocked = assertSameOrigin(request);
    if (csrfBlocked) return respond(csrfBlocked);
  }

  if (isProductionLikeHosted && !isAdmin) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payment" },
      outcome: "DENIED",
      reason: AuditReason.FORBIDDEN,
    });
    return respond(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  if (!hasTokenAccess && !isAdmin) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payment" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payment" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const providerRef = typeof body.providerRef === "string" ? body.providerRef.trim() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const callbackStatus = normalizeCallbackStatus(body.status);

  if (!callbackStatus) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payment", id: paymentId || null },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(NextResponse.json({ error: "Invalid status" }, { status: 400 }));
  }

  const payment = paymentId
    ? await prisma.payment.findUnique({ where: { id: paymentId } })
    : providerRef
    ? await prisma.payment.findFirst({ where: { providerRef } })
    : orderId
    ? await prisma.payment.findUnique({ where: { orderId } })
    : null;

  if (!payment) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payment", id: paymentId || providerRef || orderId || null },
      outcome: "CONFLICT",
      reason: AuditReason.NOT_FOUND,
    });
    return respond(NextResponse.json({ error: "Payment not found" }, { status: 404 }));
  }

  let result: {
    updatedPayment: {
      id: string;
      orderId: string;
      provider: string;
      providerRef: string | null;
      status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
      amountCents: number;
      currency: string;
    };
    finalOrder: {
      id: string;
      status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELED" | "FULFILLING" | "REFUNDED";
      paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    };
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: {
          id: true,
          sellerId: true,
          totalCents: true,
          feesCents: true,
          currency: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              type: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const desiredLedgerStatus =
        callbackStatus === "PAID" ? PaymentLedgerStatus.CONFIRMED : PaymentLedgerStatus.FAILED;
      const paymentMethod = payment.method ?? order.paymentMethod ?? null;
      const isOnlinePayment = paymentMethod !== "CASH";

      const latestLedger = await tx.paymentLedger.findFirst({
        where: { orderId: order.id },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          status: true,
        },
      });

      if (isOnlinePayment && !latestLedger) {
        throw new Error("LEDGER_REQUIRED_FOR_ONLINE");
      }

      let effectiveLedgerStatus: PaymentLedgerStatus | null = latestLedger?.status ?? null;

      if (latestLedger && latestLedger.status === PaymentLedgerStatus.INITIATED) {
        const moved = await tx.paymentLedger.updateMany({
          where: {
            id: latestLedger.id,
            status: PaymentLedgerStatus.INITIATED,
          },
          data: {
            status: desiredLedgerStatus,
          },
        });

        if (moved.count === 1) {
          effectiveLedgerStatus = desiredLedgerStatus;
        } else {
          const refreshedLedger = await tx.paymentLedger.findUnique({
            where: { id: latestLedger.id },
            select: { status: true },
          });

          effectiveLedgerStatus = refreshedLedger?.status ?? latestLedger.status;
        }
      }

      const effectiveCallbackStatus: "PAID" | "FAILED" | null =
        effectiveLedgerStatus === PaymentLedgerStatus.CONFIRMED
          ? "PAID"
          : effectiveLedgerStatus === PaymentLedgerStatus.FAILED
          ? "FAILED"
          : isOnlinePayment
          ? null
          : callbackStatus;

      if (!effectiveCallbackStatus) {
        const unchangedPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        return {
          updatedPayment: unchangedPayment ?? payment,
          finalOrder: {
            id: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
          },
        };
      }

      const paymentStatusesForTransition: PaymentStatus[] =
        effectiveCallbackStatus === "PAID" ? ["PENDING", "PAID"] : ["PENDING", "FAILED"];

      await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: {
            in: paymentStatusesForTransition,
          },
        },
        data: {
          status: effectiveCallbackStatus,
          ...(providerRef ? { providerRef } : {}),
        },
      });

      const updatedPayment = await tx.payment.findUnique({ where: { id: payment.id } });
      if (!updatedPayment) {
        throw new Error("PAYMENT_NOT_FOUND");
      }

      if (effectiveCallbackStatus === "PAID") {
        const nextOrderStatus = order.status === "PENDING" ? "CONFIRMED" : order.status;
        const paidAt = new Date();

        const paidOrderTransition = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "PENDING",
          },
          data: {
            status: nextOrderStatus,
            paymentStatus: "PAID",
          },
        });

        if (paidOrderTransition.count === 1) {
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              status: nextOrderStatus,
              note: `Payment callback confirmed (${updatedPayment.provider})`,
            },
          });
        }

        await tx.prestaBooking.updateMany({
          where: {
            orderId: order.id,
            status: {
              in: [PrestaBookingStatus.PENDING, PrestaBookingStatus.CONFIRMED],
            },
          },
          data: {
            status: PrestaBookingStatus.PAID,
            paidAt,
          },
        });

        await tx.tiakDelivery.updateMany({
          where: {
            orderId: order.id,
            OR: [{ paymentStatus: null }, { paymentStatus: "PENDING" }],
          },
          data: {
            paymentStatus: "PAID",
            paidAt,
          },
        });

        if (order.sellerId) {
          const existingPayout = await tx.payout.findFirst({
            where: { orderId: order.id, sellerId: order.sellerId },
            select: { id: true },
          });

          if (!existingPayout) {
            await tx.payout.create({
              data: {
                sellerId: order.sellerId,
                orderId: order.id,
                amountCents: Math.max(order.totalCents - order.feesCents, 0),
                currency: order.currency,
                status: "PENDING",
              },
            });
          }
        }
      } else {
        const failedOrderStatus = order.status === "PENDING" ? "CANCELED" : order.status;
        const failedOrderTransition = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "PENDING",
          },
          data: {
            status: failedOrderStatus,
            paymentStatus: "FAILED",
          },
        });

        if (failedOrderTransition.count === 1) {
          const localItemsByProduct = groupLocalItemsByProduct(order.items);
          if (localItemsByProduct.size > 0) {
            await incrementLocalProductStock(tx, localItemsByProduct);
          }

          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              status: failedOrderStatus,
              note: `Payment callback failed (${updatedPayment.provider})`,
            },
          });
        }

        await tx.tiakDelivery.updateMany({
          where: {
            orderId: order.id,
            OR: [{ paymentStatus: null }, { paymentStatus: "PENDING" }],
          },
          data: {
            paymentStatus: "FAILED",
          },
        });
      }

      const finalOrder = await tx.order.findUnique({
        where: { id: updatedPayment.orderId },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
        },
      });

      return {
        updatedPayment,
        finalOrder: finalOrder ?? {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      };
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LEDGER_REQUIRED_FOR_ONLINE") {
        auditLog({
          correlationId,
          actor,
          action,
          entity: { type: "Payment", id: payment.id },
          outcome: "CONFLICT",
          reason: AuditReason.LEDGER_MISSING,
          metadata: { orderId: payment.orderId },
        });
        return respond(
          NextResponse.json(
            {
              error: "LEDGER_REQUIRED_FOR_ONLINE",
              message: "Payment ledger is required for online callbacks.",
            },
            { status: 409 }
          )
        );
      }

      if (error.message === "ORDER_NOT_FOUND") {
        auditLog({
          correlationId,
          actor,
          action,
          entity: { type: "Order", id: payment.orderId },
          outcome: "CONFLICT",
          reason: AuditReason.NOT_FOUND,
        });
        return respond(
          NextResponse.json(
            { error: "ORDER_NOT_FOUND", message: "Order not found for this payment." },
            { status: 404 }
          )
        );
      }
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "Payment", id: payment.id },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(
      NextResponse.json(
        {
          error: "PRISMA_ERROR",
          message: "Database unavailable.",
        },
        { status: 503 }
      )
    );
  }

  auditLog({
    correlationId,
    actor,
    action,
    entity: { type: "Payment", id: result.updatedPayment.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: {
      orderId: result.updatedPayment.orderId,
      paymentStatus: result.updatedPayment.status,
      orderPaymentStatus: result.finalOrder.paymentStatus,
      amountCents: result.updatedPayment.amountCents,
      currency: result.updatedPayment.currency,
    },
  });

  if (result.updatedPayment.status === "PAID" && result.finalOrder.paymentStatus === "PAID") {
    await NotificationService.queueOrderPaidEmail(result.updatedPayment.orderId).catch(() => null);
  }

  return respond(
    NextResponse.json({
      success: true,
      payment: {
        id: result.updatedPayment.id,
        orderId: result.updatedPayment.orderId,
        provider: result.updatedPayment.provider,
        providerRef: result.updatedPayment.providerRef,
        status: result.updatedPayment.status,
        amountCents: result.updatedPayment.amountCents,
        currency: result.updatedPayment.currency,
      },
      order: result.finalOrder,
    })
  );
}
