import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  PaymentLedgerStatus,
  PrestaBookingStatus,
  PrestaPayoutStatus,
  TiakPayoutStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertAllowedHost } from "@/lib/request-security";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { groupLocalItemsByProduct, incrementLocalProductStock } from "@/lib/order-stock";

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
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const actor = { system: true as const };
  const action = "payments.webhook";

  const hostBlocked = assertAllowedHost(request);
  if (hostBlocked) return respond(hostBlocked);

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request)) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger" },
      outcome: "DENIED",
      reason: AuditReason.FORBIDDEN,
    });
    return respond(errorResponse(400, "INVALID_SIGNATURE", "Invalid webhook signature."));
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return null;
    }
  })();

  if (!body || typeof body !== "object") {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_PAYLOAD", "Invalid JSON payload."));
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
  const orderId = normalizeString(
    (body as { orderId?: unknown; order_id?: unknown }).orderId ??
      (body as { order_id?: unknown }).order_id
  );

  if (!webhookStatus || (!intentId && !orderId)) {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
      metadata: { hasIntentId: Boolean(intentId), hasOrderId: Boolean(orderId) },
    });
    return respond(errorResponse(400, "INVALID_PAYLOAD", "status + intentId or orderId are required."));
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
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger", id: orderId || null },
      outcome: "CONFLICT",
      reason: AuditReason.LEDGER_MISSING,
      metadata: { hasIntentId: Boolean(intentId) },
    });
    return respond(errorResponse(400, "LEDGER_NOT_FOUND", "Payment ledger not found for webhook payload."));
  }

  try {
    const transition = await prisma.$transaction(async (tx) => {
      const desiredLedgerStatus =
        webhookStatus === "CONFIRMED" ? PaymentLedgerStatus.CONFIRMED : PaymentLedgerStatus.FAILED;

      const currentLedger = await tx.paymentLedger.findUnique({
        where: { id: resolvedLedger.id },
        select: {
          id: true,
          status: true,
          contextType: true,
          contextId: true,
          orderId: true,
          providerIntentId: true,
        },
      });

      if (!currentLedger) {
        throw new Error("LEDGER_NOT_FOUND");
      }

      let effectiveLedgerStatus = currentLedger.status;

      if (currentLedger.status === PaymentLedgerStatus.INITIATED) {
        const moved = await tx.paymentLedger.updateMany({
          where: {
            id: currentLedger.id,
            status: PaymentLedgerStatus.INITIATED,
          },
          data: {
            provider: providerName,
            providerIntentId: currentLedger.providerIntentId ?? (intentId || null),
            status: desiredLedgerStatus,
          },
        });

        if (moved.count === 1) {
          effectiveLedgerStatus = desiredLedgerStatus;
        } else {
          const refreshed = await tx.paymentLedger.findUnique({
            where: { id: currentLedger.id },
            select: { status: true },
          });
          effectiveLedgerStatus = refreshed?.status ?? currentLedger.status;
        }
      }

      let prestaPayoutReadyCount = 0;
      let tiakPayoutReadyCount = 0;
      let immoPurchaseId: string | null = null;
      let immoPurchaseStatus: string | null = null;
      let autoPurchaseId: string | null = null;
      let autoPurchaseStatus: string | null = null;
      let carPurchaseId: string | null = null;
      let carPurchaseStatus: string | null = null;

      if (effectiveLedgerStatus === PaymentLedgerStatus.CONFIRMED) {
        if (currentLedger.contextType === "PRESTA_BOOKING") {
          const updated = await tx.prestaPayout.updateMany({
            where: {
              bookingId: currentLedger.contextId,
              status: { in: [PrestaPayoutStatus.PENDING] },
            },
            data: { status: PrestaPayoutStatus.READY },
          });
          prestaPayoutReadyCount = updated.count;
        }

        if (currentLedger.contextType === "TIAK_DELIVERY") {
          const updated = await tx.tiakPayout.updateMany({
            where: {
              deliveryId: currentLedger.contextId,
              status: { in: [TiakPayoutStatus.PENDING] },
            },
            data: { status: TiakPayoutStatus.READY },
          });
          tiakPayoutReadyCount = updated.count;
        }

        if (currentLedger.contextType === "IMMO_MONETIZATION") {
          const purchase = await tx.immoMonetizationPurchase.findFirst({
            where: { paymentLedgerId: currentLedger.id },
            select: {
              id: true,
              listingId: true,
              publisherId: true,
              kind: true,
              durationDays: true,
              status: true,
              listing: {
                select: {
                  id: true,
                  featuredUntil: true,
                  boostUntil: true,
                },
              },
            },
          });

          if (purchase) {
            const confirmed = await tx.immoMonetizationPurchase.updateMany({
              where: {
                id: purchase.id,
                status: "PENDING",
              },
              data: {
                status: "CONFIRMED",
              },
            });

            if (confirmed.count === 1) {
              const now = new Date();

              if (purchase.kind === "FEATURED" && purchase.listingId && purchase.listing) {
                const base =
                  purchase.listing.featuredUntil && purchase.listing.featuredUntil > now
                    ? purchase.listing.featuredUntil
                    : now;
                const featuredUntil = new Date(
                  base.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000
                );
                await tx.immoListing.update({
                  where: { id: purchase.listingId },
                  data: {
                    isFeatured: true,
                    featuredUntil,
                    monetizationUpdatedAt: now,
                  },
                });
              } else if (purchase.kind === "BOOST" && purchase.listingId && purchase.listing) {
                const base =
                  purchase.listing.boostUntil && purchase.listing.boostUntil > now
                    ? purchase.listing.boostUntil
                    : now;
                const boostUntil = new Date(
                  base.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000
                );
                await tx.immoListing.update({
                  where: { id: purchase.listingId },
                  data: {
                    boostUntil,
                    monetizationUpdatedAt: now,
                  },
                });
              } else if (purchase.kind === "BOOST_PACK_10") {
                await tx.immoMonetizationBalance.upsert({
                  where: { publisherId: purchase.publisherId },
                  create: {
                    publisherId: purchase.publisherId,
                    boostCredits: 10,
                    featuredCredits: 0,
                  },
                  update: {
                    boostCredits: { increment: 10 },
                  },
                });
              } else if (purchase.kind === "FEATURED_PACK_4") {
                await tx.immoMonetizationBalance.upsert({
                  where: { publisherId: purchase.publisherId },
                  create: {
                    publisherId: purchase.publisherId,
                    boostCredits: 0,
                    featuredCredits: 4,
                  },
                  update: {
                    featuredCredits: { increment: 4 },
                  },
                });
              } else if (purchase.kind === "EXTRA_SLOTS_10") {
                await tx.immoPublisher.updateMany({
                  where: {
                    id: purchase.publisherId,
                    type: "AGENCY",
                    status: "ACTIVE",
                  },
                  data: {
                    extraSlots: { increment: 10 },
                  },
                });
              }
            }

            const resolved = await tx.immoMonetizationPurchase.findUnique({
              where: { id: purchase.id },
              select: { id: true, status: true },
            });
            immoPurchaseId = resolved?.id ?? purchase.id;
            immoPurchaseStatus = resolved?.status ?? purchase.status;
          }
        }

        if (currentLedger.contextType === "AUTO_MONETIZATION") {
          const purchase = await tx.autoMonetizationPurchase.findFirst({
            where: { paymentLedgerId: currentLedger.id },
            select: {
              id: true,
              listingId: true,
              publisherId: true,
              kind: true,
              durationDays: true,
              status: true,
              listing: {
                select: {
                  id: true,
                  featuredUntil: true,
                  boostUntil: true,
                },
              },
            },
          });

          if (purchase) {
            const confirmed = await tx.autoMonetizationPurchase.updateMany({
              where: {
                id: purchase.id,
                status: "PENDING",
              },
              data: {
                status: "CONFIRMED",
              },
            });

            if (confirmed.count === 1) {
              const now = new Date();

              if (purchase.kind === "FEATURED" && purchase.listingId && purchase.listing) {
                const base =
                  purchase.listing.featuredUntil && purchase.listing.featuredUntil > now
                    ? purchase.listing.featuredUntil
                    : now;
                const featuredUntil = new Date(
                  base.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000
                );
                await tx.autoListing.update({
                  where: { id: purchase.listingId },
                  data: {
                    isFeatured: true,
                    featuredUntil,
                    monetizationUpdatedAt: now,
                  },
                });
              } else if (purchase.kind === "BOOST" && purchase.listingId && purchase.listing) {
                const base =
                  purchase.listing.boostUntil && purchase.listing.boostUntil > now
                    ? purchase.listing.boostUntil
                    : now;
                const boostUntil = new Date(
                  base.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000
                );
                await tx.autoListing.update({
                  where: { id: purchase.listingId },
                  data: {
                    boostUntil,
                    monetizationUpdatedAt: now,
                  },
                });
              } else if (purchase.kind === "BOOST_PACK_10") {
                await tx.autoMonetizationBalance.upsert({
                  where: { publisherId: purchase.publisherId },
                  create: {
                    publisherId: purchase.publisherId,
                    boostCredits: 10,
                    featuredCredits: 0,
                  },
                  update: {
                    boostCredits: { increment: 10 },
                  },
                });
              } else if (purchase.kind === "FEATURED_PACK_4") {
                await tx.autoMonetizationBalance.upsert({
                  where: { publisherId: purchase.publisherId },
                  create: {
                    publisherId: purchase.publisherId,
                    boostCredits: 0,
                    featuredCredits: 4,
                  },
                  update: {
                    featuredCredits: { increment: 4 },
                  },
                });
              } else if (purchase.kind === "EXTRA_SLOTS_10") {
                await tx.autoPublisher.updateMany({
                  where: {
                    id: purchase.publisherId,
                    type: "DEALER",
                    status: "ACTIVE",
                  },
                  data: {
                    extraSlots: { increment: 10 },
                  },
                });
              }
            }

            const resolved = await tx.autoMonetizationPurchase.findUnique({
              where: { id: purchase.id },
              select: { id: true, status: true },
            });
            autoPurchaseId = resolved?.id ?? purchase.id;
            autoPurchaseStatus = resolved?.status ?? purchase.status;
          }
        }
        if (currentLedger.contextType === "CARS_MONETIZATION") {
          const purchase = await tx.carMonetizationPurchase.findFirst({
            where: { paymentLedgerId: currentLedger.id },
            select: {
              id: true,
              listingId: true,
              publisherId: true,
              kind: true,
              durationDays: true,
              status: true,
              listing: {
                select: {
                  id: true,
                  featuredUntil: true,
                  boostUntil: true,
                },
              },
            },
          });

          if (purchase) {
            const confirmed = await tx.carMonetizationPurchase.updateMany({
              where: {
                id: purchase.id,
                status: "PENDING",
              },
              data: {
                status: "CONFIRMED",
              },
            });

            if (confirmed.count === 1) {
              const now = new Date();

              if (purchase.kind === "FEATURED" && purchase.listingId && purchase.listing) {
                const base =
                  purchase.listing.featuredUntil && purchase.listing.featuredUntil > now
                    ? purchase.listing.featuredUntil
                    : now;
                const featuredUntil = new Date(
                  base.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000
                );
                await tx.carListing.update({
                  where: { id: purchase.listingId },
                  data: {
                    isFeatured: true,
                    featuredUntil,
                    monetizationUpdatedAt: now,
                  },
                });
              } else if (purchase.kind === "BOOST" && purchase.listingId && purchase.listing) {
                const base =
                  purchase.listing.boostUntil && purchase.listing.boostUntil > now
                    ? purchase.listing.boostUntil
                    : now;
                const boostUntil = new Date(
                  base.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000
                );
                await tx.carListing.update({
                  where: { id: purchase.listingId },
                  data: {
                    boostUntil,
                    monetizationUpdatedAt: now,
                  },
                });
              } else if (purchase.kind === "BOOST_PACK_10") {
                await tx.carMonetizationBalance.upsert({
                  where: { publisherId: purchase.publisherId },
                  create: {
                    publisherId: purchase.publisherId,
                    boostCredits: 10,
                    featuredCredits: 0,
                  },
                  update: {
                    boostCredits: { increment: 10 },
                  },
                });
              } else if (purchase.kind === "FEATURED_PACK_4") {
                await tx.carMonetizationBalance.upsert({
                  where: { publisherId: purchase.publisherId },
                  create: {
                    publisherId: purchase.publisherId,
                    boostCredits: 0,
                    featuredCredits: 4,
                  },
                  update: {
                    featuredCredits: { increment: 4 },
                  },
                });
              } else if (purchase.kind === "EXTRA_SLOTS_10") {
                await tx.carPublisher.updateMany({
                  where: {
                    id: purchase.publisherId,
                    type: "DEALER",
                    status: "ACTIVE",
                  },
                  data: {
                    extraSlots: { increment: 10 },
                  },
                });
              }
            }

            const resolved = await tx.carMonetizationPurchase.findUnique({
              where: { id: purchase.id },
              select: { id: true, status: true },
            });
            carPurchaseId = resolved?.id ?? purchase.id;
            carPurchaseStatus = resolved?.status ?? purchase.status;
          }
        }
        if (currentLedger.orderId) {
          const paidAt = new Date();

          await tx.payment.updateMany({
            where: {
              orderId: currentLedger.orderId,
              status: { not: "PAID" },
            },
            data: {
              status: "PAID",
            },
          });

          const order = await tx.order.findUnique({
            where: { id: currentLedger.orderId },
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
              orderId: currentLedger.orderId,
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
              orderId: currentLedger.orderId,
              OR: [{ paymentStatus: null }, { paymentStatus: "PENDING" }],
            },
            data: {
              paymentStatus: "PAID",
              paidAt,
            },
          });
        }
      } else if (effectiveLedgerStatus === PaymentLedgerStatus.FAILED) {
        if (currentLedger.contextType === "IMMO_MONETIZATION") {
          const failed = await tx.immoMonetizationPurchase.updateMany({
            where: {
              paymentLedgerId: currentLedger.id,
              status: "PENDING",
            },
            data: {
              status: "FAILED",
            },
          });

          if (failed.count === 0) {
            const resolved = await tx.immoMonetizationPurchase.findFirst({
              where: { paymentLedgerId: currentLedger.id },
              select: { id: true, status: true },
            });
            immoPurchaseId = resolved?.id ?? null;
            immoPurchaseStatus = resolved?.status ?? null;
          } else {
            const resolved = await tx.immoMonetizationPurchase.findFirst({
              where: { paymentLedgerId: currentLedger.id },
              select: { id: true, status: true },
            });
            immoPurchaseId = resolved?.id ?? null;
            immoPurchaseStatus = resolved?.status ?? "FAILED";
          }
        }

        if (currentLedger.contextType === "AUTO_MONETIZATION") {
          const failed = await tx.autoMonetizationPurchase.updateMany({
            where: {
              paymentLedgerId: currentLedger.id,
              status: "PENDING",
            },
            data: {
              status: "FAILED",
            },
          });

          if (failed.count === 0) {
            const resolved = await tx.autoMonetizationPurchase.findFirst({
              where: { paymentLedgerId: currentLedger.id },
              select: { id: true, status: true },
            });
            autoPurchaseId = resolved?.id ?? null;
            autoPurchaseStatus = resolved?.status ?? null;
          } else {
            const resolved = await tx.autoMonetizationPurchase.findFirst({
              where: { paymentLedgerId: currentLedger.id },
              select: { id: true, status: true },
            });
            autoPurchaseId = resolved?.id ?? null;
            autoPurchaseStatus = resolved?.status ?? "FAILED";
          }
        }
        if (currentLedger.contextType === "CARS_MONETIZATION") {
          const failed = await tx.carMonetizationPurchase.updateMany({
            where: {
              paymentLedgerId: currentLedger.id,
              status: "PENDING",
            },
            data: {
              status: "FAILED",
            },
          });

          if (failed.count === 0) {
            const resolved = await tx.carMonetizationPurchase.findFirst({
              where: { paymentLedgerId: currentLedger.id },
              select: { id: true, status: true },
            });
            carPurchaseId = resolved?.id ?? null;
            carPurchaseStatus = resolved?.status ?? null;
          } else {
            const resolved = await tx.carMonetizationPurchase.findFirst({
              where: { paymentLedgerId: currentLedger.id },
              select: { id: true, status: true },
            });
            carPurchaseId = resolved?.id ?? null;
            carPurchaseStatus = resolved?.status ?? "FAILED";
          }
        }
        if (currentLedger.orderId) {
          await tx.payment.updateMany({
            where: {
              orderId: currentLedger.orderId,
              status: { not: "FAILED" },
            },
            data: { status: "FAILED" },
          });

          const order = await tx.order.findUnique({
            where: { id: currentLedger.orderId },
            select: {
              id: true,
              status: true,
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

          if (order) {
            const failedOrderStatus = order.status === "PENDING" ? "CANCELED" : order.status;
            const failedOrderTransition = await tx.order.updateMany({
              where: {
                id: order.id,
                paymentStatus: { not: "FAILED" },
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
                  note: `PayDunya webhook failed (${providerName})`,
                },
              });
            }
          }

          await tx.tiakDelivery.updateMany({
            where: {
              orderId: currentLedger.orderId,
              OR: [{ paymentStatus: null }, { paymentStatus: "PENDING" }],
            },
            data: {
              paymentStatus: "FAILED",
            },
          });
        }
      }

      return {
        ledgerId: currentLedger.id,
        orderId: currentLedger.orderId,
        requestedWebhookStatus: webhookStatus,
        ledgerStatus: effectiveLedgerStatus,
        contextType: currentLedger.contextType,
        contextId: currentLedger.contextId,
        prestaPayoutReadyCount,
        tiakPayoutReadyCount,
        immoPurchaseId,
        immoPurchaseStatus,
        autoPurchaseId,
        autoPurchaseStatus,
        carPurchaseId,
        carPurchaseStatus,
      };
    });

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger", id: transition.ledgerId },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        requestedWebhookStatus: transition.requestedWebhookStatus,
        ledgerStatus: transition.ledgerStatus,
        contextType: transition.contextType,
        contextId: transition.contextId,
        prestaPayoutReadyCount: transition.prestaPayoutReadyCount,
        tiakPayoutReadyCount: transition.tiakPayoutReadyCount,
        immoPurchaseId: transition.immoPurchaseId,
        immoPurchaseStatus: transition.immoPurchaseStatus,
        autoPurchaseId: transition.autoPurchaseId,
        autoPurchaseStatus: transition.autoPurchaseStatus,
        carPurchaseId: transition.carPurchaseId,
        carPurchaseStatus: transition.carPurchaseStatus,
      },
    });

    if (transition.ledgerStatus === "CONFIRMED" && transition.orderId) {
      await NotificationService.queueOrderPaidEmail(transition.orderId).catch(() => null);
    }

    if (transition.contextType === "IMMO_MONETIZATION") {
      auditLog({
        correlationId,
        actor,
        action:
          transition.ledgerStatus === "CONFIRMED"
            ? "immo.monetizationConfirmed"
            : transition.ledgerStatus === "FAILED"
              ? "immo.monetizationFailed"
              : "immo.monetizationPending",
        entity: { type: "ImmoMonetizationPurchase", id: transition.immoPurchaseId ?? transition.contextId },
        outcome: "SUCCESS",
        reason: AuditReason.SUCCESS,
        metadata: {
          ledgerId: transition.ledgerId,
          purchaseStatus: transition.immoPurchaseStatus,
        },
      });
    }


    if (transition.contextType === "AUTO_MONETIZATION") {
      auditLog({
        correlationId,
        actor,
        action:
          transition.ledgerStatus === "CONFIRMED"
            ? "auto.monetizationConfirmed"
            : transition.ledgerStatus === "FAILED"
              ? "auto.monetizationFailed"
              : "auto.monetizationPending",
        entity: { type: "AutoMonetizationPurchase", id: transition.autoPurchaseId ?? transition.contextId },
        outcome: "SUCCESS",
        reason: AuditReason.SUCCESS,
        metadata: {
          ledgerId: transition.ledgerId,
          purchaseStatus: transition.autoPurchaseStatus,
        },
      });
    }



    if (transition.contextType === "CARS_MONETIZATION") {
      auditLog({
        correlationId,
        actor,
        action:
          transition.ledgerStatus === "CONFIRMED"
            ? "cars.monetizationConfirmed"
            : transition.ledgerStatus === "FAILED"
              ? "cars.monetizationFailed"
              : "cars.monetizationPending",
        entity: { type: "CarMonetizationPurchase", id: transition.carPurchaseId ?? transition.contextId },
        outcome: "SUCCESS",
        reason: AuditReason.SUCCESS,
        metadata: {
          ledgerId: transition.ledgerId,
          purchaseStatus: transition.carPurchaseStatus,
        },
      });
    }

    return respond(NextResponse.json({ success: true, transition }, { status: 200 }));
  } catch (error) {
    if (error instanceof Error && error.message === "LEDGER_NOT_FOUND") {
      auditLog({
        correlationId,
        actor,
        action,
        entity: { type: "PaymentLedger", id: resolvedLedger.id },
        outcome: "CONFLICT",
        reason: AuditReason.LEDGER_MISSING,
      });
      return respond(errorResponse(400, "LEDGER_NOT_FOUND", "Payment ledger not found for webhook payload."));
    }

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "PaymentLedger", id: resolvedLedger.id },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
