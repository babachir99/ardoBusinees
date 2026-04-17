import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical } from "@/lib/verticals";
import { assertSameOrigin } from "@/lib/request-security";

const allDisputeStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] as const;
type DisputeStatusValue = (typeof allDisputeStatuses)[number];

function normalizeStatus(value: unknown): DisputeStatusValue | null {
  const status = String(value ?? "").trim().toUpperCase();
  if (!status) return null;
  if ((allDisputeStatuses as readonly string[]).includes(status)) {
    return status as DisputeStatusValue;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

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

      if (dispute.status === "RESOLVED" && nextStatus !== "RESOLVED") {
        throw new Error("DISPUTE_ALREADY_RESOLVED");
      }

      const updated = await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: nextStatus,
          resolvedAt:
            nextStatus === "RESOLVED"
              ? (dispute.resolvedAt ?? new Date())
              : dispute.resolvedAt,
        },
      });

      let payoutReleasedCount = 0;

      if (
        nextStatus === "RESOLVED" &&
        (dispute.vertical === Vertical.SHOP || dispute.vertical === Vertical.PRESTA)
      ) {
        const remainingBlockingForReference = await tx.dispute.count({
          where: {
            referenceId: dispute.referenceId,
            status: { in: ["OPEN", "IN_REVIEW"] },
            id: { not: dispute.id },
          },
        });

        if (remainingBlockingForReference === 0) {
          const releaseResult = await tx.payout.updateMany({
            where: {
              orderId: dispute.referenceId,
              status: "HOLD",
            },
            data: {
              status: "PENDING",
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

    if (error instanceof Error && error.message === "DISPUTE_ALREADY_RESOLVED") {
      return NextResponse.json(
        { error: "Resolved disputes cannot be moved back to another status." },
        { status: 400 }
      );
    }

    throw error;
  }
}
