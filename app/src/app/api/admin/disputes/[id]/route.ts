import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DisputeStatus, PayoutStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical } from "@/lib/verticals";

function normalizeStatus(value: unknown): DisputeStatus | null {
  const status = String(value ?? "").trim().toUpperCase();
  if (!status) return null;
  return Object.values(DisputeStatus).includes(status as DisputeStatus)
    ? (status as DisputeStatus)
    : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nextStatus = normalizeStatus(body?.status);

  if (!nextStatus) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id },
      });

      if (!dispute) {
        throw new Error("DISPUTE_NOT_FOUND");
      }

      const updated = await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: nextStatus,
          resolvedAt: nextStatus === DisputeStatus.RESOLVED ? new Date() : null,
        },
      });

      let payoutReleasedCount = 0;

      if (
        nextStatus === DisputeStatus.RESOLVED &&
        (dispute.vertical === Vertical.SHOP || dispute.vertical === Vertical.PRESTA)
      ) {
        const remainingOpenForReference = await tx.dispute.count({
          where: {
            referenceId: dispute.referenceId,
            status: DisputeStatus.OPEN,
            id: { not: dispute.id },
          },
        });

        if (remainingOpenForReference === 0) {
          const releaseResult = await tx.payout.updateMany({
            where: {
              orderId: dispute.referenceId,
              status: PayoutStatus.HOLD,
            },
            data: {
              status: PayoutStatus.PENDING,
            },
          });

          payoutReleasedCount = releaseResult.count;
        }
      }

      return { updated, payoutReleasedCount };
    });

    return NextResponse.json({
      dispute: result.updated,
      payoutReleasedCount: result.payoutReleasedCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DISPUTE_NOT_FOUND") {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    throw error;
  }
}
