import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const session = await getServerSession(authOptions);
  const callbackToken = request.headers.get("x-payments-callback-token");
  const expectedToken = process.env.PAYMENTS_CALLBACK_TOKEN;

  const hasTokenAccess = Boolean(expectedToken && callbackToken === expectedToken);
  const isAdmin = session?.user?.role === "ADMIN";

  if (!hasTokenAccess && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const providerRef = typeof body.providerRef === "string" ? body.providerRef.trim() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const callbackStatus = normalizeCallbackStatus(body.status);

  if (!callbackStatus) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const payment = paymentId
    ? await prisma.payment.findUnique({ where: { id: paymentId } })
    : providerRef
    ? await prisma.payment.findFirst({ where: { providerRef } })
    : orderId
    ? await prisma.payment.findUnique({ where: { orderId } })
    : null;

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const paymentUpdateData: {
      status: "PAID" | "FAILED";
      providerRef?: string;
    } = {
      status: callbackStatus,
    };

    if (providerRef) {
      paymentUpdateData.providerRef = providerRef;
    }

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: paymentUpdateData,
    });

    const order = await tx.order.findUnique({
      where: { id: updatedPayment.orderId },
      select: {
        id: true,
        sellerId: true,
        totalCents: true,
        feesCents: true,
        currency: true,
        status: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    if (callbackStatus === "PAID") {
      const nextOrderStatus = order.status === "PENDING" ? "CONFIRMED" : order.status;

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextOrderStatus,
          paymentStatus: "PAID",
          events: {
            create: [
              {
                status: nextOrderStatus,
                note: `Payment callback confirmed (${updatedPayment.provider})`,
              },
            ],
          },
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
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "FAILED",
          events: {
            create: [
              {
                status: order.status,
                note: `Payment callback failed (${updatedPayment.provider})`,
              },
            ],
          },
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

    return { updatedPayment, finalOrder };
  });

  return NextResponse.json({
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
  });
}
