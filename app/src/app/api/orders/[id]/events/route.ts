import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentLedgerStatus, type OrderStatus, type PaymentStatus } from "@prisma/client";
import { NotificationService } from "@/lib/notifications/NotificationService";

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
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const typedStatus = status as OrderStatus;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      sellerId: true,
      userId: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      totalCents: true,
      feesCents: true,
      currency: true,
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

  const wasFinalState = order.status === "CANCELED" || order.status === "REFUNDED";
  const isFinalState = typedStatus === "CANCELED" || typedStatus === "REFUNDED";
  const shouldRestock = isFinalState && !wasFinalState;

  let nextPaymentStatus: PaymentStatus | undefined;
  if (typedStatus === "REFUNDED") {
    nextPaymentStatus = "REFUNDED";
  } else if (typedStatus === "CANCELED") {
    nextPaymentStatus = order.paymentStatus === "PAID" ? "REFUNDED" : "FAILED";
  } else if (
    typedStatus === "DELIVERED" &&
    order.paymentMethod === "CASH" &&
    order.paymentStatus === "PENDING"
  ) {
    nextPaymentStatus = "PAID";
  }

  const isCashOrManualPayment = order.paymentMethod === "CASH";
  const isOnlinePayment = !isCashOrManualPayment;

  if (nextPaymentStatus && isOnlinePayment) {
    const latestLedger = await prisma.paymentLedger.findFirst({
      where: { orderId: order.id },
      orderBy: [{ createdAt: "desc" }],
      select: { status: true },
    });

    if (!latestLedger) {
      return NextResponse.json(
        {
          error: "LEDGER_REQUIRED_FOR_ONLINE",
          message: "Payment ledger is required for online payment status updates.",
        },
        { status: 409 }
      );
    }

    if (
      order.paymentStatus === "PAID" &&
      (nextPaymentStatus === "FAILED" || nextPaymentStatus === "REFUNDED")
    ) {
      return NextResponse.json(
        {
          error: "ONLINE_PAYMENT_TERMINAL",
          message: "Online paid orders cannot move backward to FAILED or REFUNDED.",
        },
        { status: 409 }
      );
    }

    if (nextPaymentStatus === "PAID" && latestLedger.status !== PaymentLedgerStatus.CONFIRMED) {
      return NextResponse.json(
        {
          error: "LEDGER_NOT_CONFIRMED",
          message: "Ledger must be CONFIRMED before setting payment status to PAID.",
        },
        { status: 409 }
      );
    }

    if (nextPaymentStatus === "FAILED" && latestLedger.status !== PaymentLedgerStatus.FAILED) {
      return NextResponse.json(
        {
          error: "LEDGER_NOT_FAILED",
          message: "Ledger must be FAILED before setting payment status to FAILED.",
        },
        { status: 409 }
      );
    }

    if (nextPaymentStatus === "REFUNDED") {
      return NextResponse.json(
        {
          error: "ONLINE_REFUND_NOT_ALLOWED",
          message: "Online refunds must be handled by the payment provider flow.",
        },
        { status: 409 }
      );
    }
  }

  const resultingPaymentStatus = nextPaymentStatus ?? order.paymentStatus;
  const shouldReleasePayout =
    typedStatus === "DELIVERED" && resultingPaymentStatus === "PAID" && Boolean(order.sellerId);
  const shouldFailPendingPayout =
    (typedStatus === "CANCELED" || typedStatus === "REFUNDED") && Boolean(order.sellerId);

  const localItemsByProduct = new Map<string, number>();
  if (shouldRestock) {
    for (const item of order.items) {
      if (item.type !== "LOCAL") continue;
      localItemsByProduct.set(
        item.productId,
        (localItemsByProduct.get(item.productId) ?? 0) + item.quantity
      );
    }
  }

  const event = await prisma.$transaction(async (tx) => {
    const createdEvent = await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: typedStatus,
        note: body.note ?? undefined,
        proofUrl: body.proofUrl ?? undefined,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: typedStatus,
        paymentStatus: nextPaymentStatus,
      },
    });

    if (nextPaymentStatus) {
      if (nextPaymentStatus === "PAID" && order.paymentMethod === "CASH") {
        const existingPayment = await tx.payment.findUnique({
          where: { orderId: order.id },
        });

        if (existingPayment) {
          if (existingPayment.status !== "PAID") {
            await tx.payment.update({
              where: { orderId: order.id },
              data: {
                status: "PAID",
                method: order.paymentMethod ?? undefined,
              },
            });
          }
        } else {
          await tx.payment.create({
            data: {
              orderId: order.id,
              provider: "cash_on_delivery",
              amountCents: order.totalCents,
              currency: order.currency,
              status: "PAID",
              method: order.paymentMethod ?? undefined,
              splitMeta: { mode: "delivery" },
            },
          });
        }
      } else {
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: nextPaymentStatus },
        });
      }
    }

    if (localItemsByProduct.size > 0) {
      for (const [productId, quantity] of localItemsByProduct.entries()) {
        await tx.product.update({
          where: { id: productId },
          data: {
            stockQuantity: {
              increment: quantity,
            },
          },
        });
      }
    }

    if (shouldReleasePayout && order.sellerId) {
      const payoutAmount = Math.max(order.totalCents - order.feesCents, 0);
      const existingPayout = await tx.payout.findFirst({
        where: {
          orderId: order.id,
          sellerId: order.sellerId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existingPayout) {
        await tx.payout.create({
          data: {
            sellerId: order.sellerId,
            orderId: order.id,
            amountCents: payoutAmount,
            currency: order.currency,
            status: "PAID",
          },
        });
      } else if (existingPayout.status !== "PAID") {
        await tx.payout.update({
          where: { id: existingPayout.id },
          data: { status: "PAID" },
        });
      }
    }

    if (shouldFailPendingPayout && order.sellerId) {
      await tx.payout.updateMany({
        where: {
          orderId: order.id,
          sellerId: order.sellerId,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
        },
      });
    }

    return createdEvent;
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "ORDER_STATUS_UPDATED",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        status: typedStatus,
        paymentStatus: nextPaymentStatus,
        restocked: shouldRestock,
        payoutReleased: shouldReleasePayout,
      },
    },
  });

  if (["FULFILLING", "SHIPPED", "DELIVERED"].includes(typedStatus)) {
    await NotificationService.queueDeliveryUpdateEmail({
      orderId: order.id,
      vertical: "SHOP",
      trackingStep: typedStatus,
      link: `/orders/${order.id}`,
    }).catch(() => null);
  }

  if (resultingPaymentStatus === "PAID") {
    await NotificationService.queueOrderPaidEmail(order.id).catch(() => null);
  }

  return NextResponse.json(event, { status: 201 });
}
