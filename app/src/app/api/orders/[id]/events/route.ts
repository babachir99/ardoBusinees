import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

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
      },
    },
  });

  return NextResponse.json(event, { status: 201 });
}
