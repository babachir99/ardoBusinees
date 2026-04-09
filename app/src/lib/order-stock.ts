import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const EXPIRED_PENDING_ORDER_MS = 30 * 60 * 1000;
const AUTO_RELEASE_NOTE = "Payment window expired. Stock released automatically.";

type OrderItemLike = {
  productId: string;
  quantity: number;
  type: string;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function groupLocalItemsByProduct(items: OrderItemLike[]) {
  const grouped = new Map<string, number>();

  for (const item of items) {
    if (item.type !== "LOCAL") continue;
    grouped.set(item.productId, (grouped.get(item.productId) ?? 0) + item.quantity);
  }

  return grouped;
}

export async function incrementLocalProductStock(
  tx: PrismaLike,
  grouped: Map<string, number>
) {
  for (const [productId, quantity] of grouped.entries()) {
    if (quantity <= 0) continue;
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

export async function releaseExpiredPendingLocalOrders(options?: {
  productIds?: string[];
}) {
  const productIds = Array.isArray(options?.productIds)
    ? Array.from(new Set(options!.productIds.filter(Boolean)))
    : [];
  const cutoff = new Date(Date.now() - EXPIRED_PENDING_ORDER_MS);

  const staleOrders = await prisma.order.findMany({
    where: {
      createdAt: { lt: cutoff },
      status: "PENDING",
      paymentStatus: "PENDING",
      OR: [{ paymentMethod: null }, { paymentMethod: { not: "CASH" } }],
      items: {
        some: {
          type: "LOCAL",
          ...(productIds.length > 0 ? { productId: { in: productIds } } : {}),
        },
      },
    },
    select: {
      id: true,
      items: {
        where: {
          type: "LOCAL",
        },
        select: {
          productId: true,
          quantity: true,
          type: true,
        },
      },
    },
  });

  if (staleOrders.length === 0) {
    return 0;
  }

  return prisma.$transaction(async (tx) => {
    let releasedCount = 0;

    for (const order of staleOrders) {
      const transition = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
        data: {
          status: "CANCELED",
          paymentStatus: "FAILED",
        },
      });

      if (transition.count !== 1) {
        continue;
      }

      const grouped = groupLocalItemsByProduct(order.items);
      await incrementLocalProductStock(tx, grouped);

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: "CANCELED",
          note: AUTO_RELEASE_NOTE,
        },
      });

      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
        },
      });

      await tx.paymentLedger.updateMany({
        where: {
          orderId: order.id,
          status: "INITIATED",
        },
        data: {
          status: "FAILED",
        },
      });

      releasedCount += 1;
    }

    return releasedCount;
  });
}
