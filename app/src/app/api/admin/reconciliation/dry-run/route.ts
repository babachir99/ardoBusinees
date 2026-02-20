import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

const ACTIVE_DISPUTE_STATUSES = ["OPEN", "IN_REVIEW"] as const;

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "admin.reconciliationDryRun";

  const session = await getServerSession(authOptions);
  const actor = { userId: session?.user?.id ?? null, role: session?.user?.role ?? null };

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "ReconciliationDryRun" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Admin access required."));
  }

  try {
    const confirmedLedgers = await prisma.paymentLedger.findMany({
      where: {
        status: "CONFIRMED",
        contextType: { in: ["PRESTA_BOOKING", "TIAK_DELIVERY"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        contextType: true,
        contextId: true,
        orderId: true,
        amountTotalCents: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    const prestaContextIds = confirmedLedgers
      .filter((entry) => entry.contextType === "PRESTA_BOOKING")
      .map((entry) => entry.contextId);
    const tiakContextIds = confirmedLedgers
      .filter((entry) => entry.contextType === "TIAK_DELIVERY")
      .map((entry) => entry.contextId);

    const [prestaPayouts, tiakPayouts] = await Promise.all([
      prestaContextIds.length
        ? prisma.prestaPayout.findMany({
            where: { bookingId: { in: prestaContextIds } },
            select: { id: true, bookingId: true, status: true, createdAt: true },
          })
        : Promise.resolve([]),
      tiakContextIds.length
        ? prisma.tiakPayout.findMany({
            where: { deliveryId: { in: tiakContextIds } },
            select: { id: true, deliveryId: true, status: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const prestaPayoutMap = new Map(prestaPayouts.map((entry) => [entry.bookingId, entry]));
    const tiakPayoutMap = new Map(tiakPayouts.map((entry) => [entry.deliveryId, entry]));

    const confirmedLedgerMissingPayout = confirmedLedgers
      .filter((entry) => {
        const payout =
          entry.contextType === "PRESTA_BOOKING"
            ? prestaPayoutMap.get(entry.contextId)
            : tiakPayoutMap.get(entry.contextId);
        if (!payout) return true;
        return payout.status !== "READY" && payout.status !== "PAID";
      })
      .map((entry) => {
        const payout =
          entry.contextType === "PRESTA_BOOKING"
            ? prestaPayoutMap.get(entry.contextId)
            : tiakPayoutMap.get(entry.contextId);
        return {
          ledgerId: entry.id,
          contextType: entry.contextType,
          contextId: entry.contextId,
          orderId: entry.orderId,
          ledgerStatus: entry.status,
          payoutId: payout?.id ?? null,
          payoutStatus: payout?.status ?? null,
          amountTotalCents: entry.amountTotalCents,
          currency: entry.currency,
          createdAt: entry.createdAt,
        };
      })
      .slice(0, 50);

    const activeDisputes = await prisma.dispute.findMany({
      where: {
        status: { in: [...ACTIVE_DISPUTE_STATUSES] },
        contextType: { in: ["PRESTA_BOOKING", "TIAK_DELIVERY"] },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        contextType: true,
        contextId: true,
        status: true,
      },
    });

    const activePrestaIds = activeDisputes
      .filter((entry) => entry.contextType === "PRESTA_BOOKING")
      .map((entry) => entry.contextId);
    const activeTiakIds = activeDisputes
      .filter((entry) => entry.contextType === "TIAK_DELIVERY")
      .map((entry) => entry.contextId);

    const [prestaReadyOrPaid, tiakReadyOrPaid] = await Promise.all([
      activePrestaIds.length
        ? prisma.prestaPayout.findMany({
            where: {
              bookingId: { in: activePrestaIds },
              status: { in: ["READY", "PAID"] },
            },
            select: {
              id: true,
              bookingId: true,
              status: true,
              amountTotalCents: true,
              currency: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      activeTiakIds.length
        ? prisma.tiakPayout.findMany({
            where: {
              deliveryId: { in: activeTiakIds },
              status: { in: ["READY", "PAID"] },
            },
            select: {
              id: true,
              deliveryId: true,
              status: true,
              amountTotalCents: true,
              currency: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const disputeByContext = new Map(
      activeDisputes.map((entry) => [`${entry.contextType}:${entry.contextId}`, entry])
    );

    const payoutReadyButActiveDispute = [
      ...prestaReadyOrPaid.map((entry) => {
        const dispute = disputeByContext.get(`PRESTA_BOOKING:${entry.bookingId}`);
        return {
          payoutType: "PRESTA" as const,
          payoutId: entry.id,
          contextType: "PRESTA_BOOKING",
          contextId: entry.bookingId,
          payoutStatus: entry.status,
          disputeId: dispute?.id ?? "",
          disputeStatus: dispute?.status ?? "",
          amountTotalCents: entry.amountTotalCents,
          currency: entry.currency,
          createdAt: entry.createdAt,
        };
      }),
      ...tiakReadyOrPaid.map((entry) => {
        const dispute = disputeByContext.get(`TIAK_DELIVERY:${entry.deliveryId}`);
        return {
          payoutType: "TIAK" as const,
          payoutId: entry.id,
          contextType: "TIAK_DELIVERY",
          contextId: entry.deliveryId,
          payoutStatus: entry.status,
          disputeId: dispute?.id ?? "",
          disputeStatus: dispute?.status ?? "",
          amountTotalCents: entry.amountTotalCents,
          currency: entry.currency,
          createdAt: entry.createdAt,
        };
      }),
    ]
      .filter((entry) => Boolean(entry.disputeId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);

    const paidOrders = await prisma.order.findMany({
      where: {
        OR: [{ paymentStatus: "PAID" }, { payment: { is: { status: "PAID" } } }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        paymentStatus: true,
        paymentMethod: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        payment: {
          select: {
            status: true,
            method: true,
          },
        },
        paymentLedgers: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            contextType: true,
          },
        },
      },
    });

    const orderPaidButLedgerNotConfirmed = paidOrders
      .filter((order) => {
        const effectiveMethod = order.payment?.method ?? order.paymentMethod;
        const isOnline = effectiveMethod !== null && effectiveMethod !== "CASH";
        if (!isOnline) return false;

        const hasPaid = order.paymentStatus === "PAID" || order.payment?.status === "PAID";
        if (!hasPaid) return false;

        const ledger = order.paymentLedgers[0];
        if (!ledger) return true;
        return ledger.status !== "CONFIRMED";
      })
      .map((order) => {
        const ledger = order.paymentLedgers[0] ?? null;
        return {
          orderId: order.id,
          orderPaymentStatus: order.paymentStatus,
          paymentStatus: order.payment?.status ?? null,
          ledgerId: ledger?.id ?? null,
          ledgerStatus: ledger?.status ?? null,
          amountTotalCents: order.totalCents,
          currency: order.currency,
          createdAt: order.createdAt,
        };
      })
      .slice(0, 50);

    const findings = {
      confirmedLedgerMissingPayout,
      payoutReadyButActiveDispute,
      orderPaidButLedgerNotConfirmed,
    };

    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "ReconciliationDryRun" },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        confirmedLedgerMissingPayoutCount: confirmedLedgerMissingPayout.length,
        payoutReadyButActiveDisputeCount: payoutReadyButActiveDispute.length,
        orderPaidButLedgerNotConfirmedCount: orderPaidButLedgerNotConfirmed.length,
      },
    });

    return respond(
      NextResponse.json({
        findings,
        meta: {
          confirmedLedgerMissingPayoutCount: confirmedLedgerMissingPayout.length,
          payoutReadyButActiveDisputeCount: payoutReadyButActiveDispute.length,
          orderPaidButLedgerNotConfirmedCount: orderPaidButLedgerNotConfirmed.length,
        },
      })
    );
  } catch {
    auditLog({
      correlationId,
      actor,
      action,
      entity: { type: "ReconciliationDryRun" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
