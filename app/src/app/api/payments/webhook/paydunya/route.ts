import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PrestaBookingStatus, PrestaPayoutStatus, TiakPayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeWebhookStatus(value: unknown): "CONFIRMED" | "FAILED" | null {
  const status = String(value ?? "").trim().toUpperCase();

  if (["PAID", "SUCCESS", "SUCCEEDED", "COMPLETED", "OK", "CONFIRMED"].includes(status)) {
    return "CONFIRMED";
  }

  if (["FAILED", "FAIL", "ERROR", "CANCELED", "CANCELLED", "REFUSED"].includes(status)) {
    return "FAILED";
  }

  return null;
}

function verifySignature(rawBody: string, request: NextRequest) {
  const webhookSecret = process.env.PAYDUNYA_WEBHOOK_SECRET;
  const signature =
    request.headers.get("x-paydunya-signature") ??
    request.headers.get("x-signature") ??
    "";

  if (webhookSecret) {
    if (!signature) return false;
    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  }

  const callbackToken = request.headers.get("x-payments-callback-token");
  const expectedToken = process.env.PAYMENTS_CALLBACK_TOKEN;
  if (expectedToken) {
    return callbackToken === expectedToken;
  }

  return process.env.NODE_ENV !== "production";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request)) {
    return errorResponse(400, "INVALID_SIGNATURE", "Invalid webhook signature.");
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return null;
    }
  })();

  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  const webhookStatus = normalizeWebhookStatus(
    (body as { status?: unknown; payment_status?: unknown; state?: unknown }).status ??
      (body as { payment_status?: unknown }).payment_status ??
      (body as { state?: unknown }).state
  );

  const intentId = normalizeString(
    (body as { intentId?: unknown; intent_id?: unknown; transaction_id?: unknown }).intentId ??
      (body as { intent_id?: unknown }).intent_id ??
      (body as { transaction_id?: unknown }).transaction_id
  );
  const orderId = normalizeString((body as { orderId?: unknown; order_id?: unknown }).orderId ?? (body as { order_id?: unknown }).order_id);

  if (!webhookStatus || (!intentId && !orderId)) {
    return errorResponse(400, "INVALID_PAYLOAD", "status + intentId or orderId are required.");
  }

  const providerName = normalizeString((body as { provider?: unknown }).provider).toUpperCase() || "PAYDUNYA";

  const ledger = intentId
    ? await prisma.paymentLedger.findFirst({
        where: { providerIntentId: intentId },
        select: {
          id: true,
          contextType: true,
          contextId: true,
          orderId: true,
          status: true,
          providerIntentId: true,
        },
      })
    : null;

  const resolvedLedger =
    ledger ??
    (orderId
      ? await prisma.paymentLedger.findFirst({
          where: { orderId },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            contextType: true,
            contextId: true,
            orderId: true,
            status: true,
            providerIntentId: true,
          },
        })
      : null);

  if (!resolvedLedger) {
    return errorResponse(400, "LEDGER_NOT_FOUND", "Payment ledger not found for webhook payload.");
  }

  const transition = await prisma.$transaction(async (tx) => {
    const ledgerStatus = webhookStatus === "CONFIRMED" ? "CONFIRMED" : "FAILED";

    const updatedLedger = await tx.paymentLedger.update({
      where: { id: resolvedLedger.id },
      data: {
        provider: providerName,
        providerIntentId: resolvedLedger.providerIntentId ?? (intentId || null),
        status: ledgerStatus,
      },
      select: {
        id: true,
        status: true,
        contextType: true,
        contextId: true,
        orderId: true,
      },
    });

    let prestaPayoutReadyCount = 0;
    let tiakPayoutReadyCount = 0;

    if (webhookStatus === "CONFIRMED") {
      if (updatedLedger.contextType === "PRESTA_BOOKING") {
        const updated = await tx.prestaPayout.updateMany({
          where: {
            bookingId: updatedLedger.contextId,
            status: { in: [PrestaPayoutStatus.PENDING] },
          },
          data: { status: PrestaPayoutStatus.READY },
        });
        prestaPayoutReadyCount = updated.count;
      }

      if (updatedLedger.contextType === "TIAK_DELIVERY") {
        const updated = await tx.tiakPayout.updateMany({
          where: {
            deliveryId: updatedLedger.contextId,
            status: { in: [TiakPayoutStatus.PENDING] },
          },
          data: { status: TiakPayoutStatus.READY },
        });
        tiakPayoutReadyCount = updated.count;
      }

      if (updatedLedger.orderId) {
        const paidAt = new Date();

        await tx.payment.updateMany({
          where: {
            orderId: updatedLedger.orderId,
            status: { not: "PAID" },
          },
          data: {
            status: "PAID",
          },
        });

        const order = await tx.order.findUnique({
          where: { id: updatedLedger.orderId },
          select: { id: true, status: true, paymentStatus: true },
        });

        if (order && order.paymentStatus !== "PAID") {
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
                    note: `PayDunya webhook confirmed (${providerName})`,
                  },
                ],
              },
            },
          });
        }

        await tx.prestaBooking.updateMany({
          where: {
            orderId: updatedLedger.orderId,
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
            orderId: updatedLedger.orderId,
            OR: [{ paymentStatus: null }, { paymentStatus: "PENDING" }],
          },
          data: {
            paymentStatus: "PAID",
            paidAt,
          },
        });
      }
    } else if (updatedLedger.orderId) {
      await tx.payment.updateMany({
        where: {
          orderId: updatedLedger.orderId,
          status: { not: "FAILED" },
        },
        data: { status: "FAILED" },
      });

      await tx.order.updateMany({
        where: {
          id: updatedLedger.orderId,
          paymentStatus: { not: "FAILED" },
        },
        data: { paymentStatus: "FAILED" },
      });

      await tx.tiakDelivery.updateMany({
        where: {
          orderId: updatedLedger.orderId,
          OR: [{ paymentStatus: null }, { paymentStatus: "PENDING" }],
        },
        data: {
          paymentStatus: "FAILED",
        },
      });
    }

    return {
      ledgerId: updatedLedger.id,
      ledgerStatus: updatedLedger.status,
      contextType: updatedLedger.contextType,
      contextId: updatedLedger.contextId,
      prestaPayoutReadyCount,
      tiakPayoutReadyCount,
    };
  });

  console.info(
    "[paydunya-webhook]",
    JSON.stringify({
      ledgerId: transition.ledgerId,
      ledgerStatus: transition.ledgerStatus,
      contextType: transition.contextType,
      contextId: transition.contextId,
      prestaPayoutReadyCount: transition.prestaPayoutReadyCount,
      tiakPayoutReadyCount: transition.tiakPayoutReadyCount,
    })
  );

  return NextResponse.json({ success: true, transition }, { status: 200 });
}