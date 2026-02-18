import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, isVertical } from "@/lib/verticals";

const blockingStatuses = ["OPEN", "IN_REVIEW"] as const;

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function serializeDispute(dispute: {
  id: string;
  vertical: string;
  referenceId: string;
  reason: string;
  status: string;
  openedById: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: dispute.id,
    vertical: dispute.vertical,
    referenceId: dispute.referenceId,
    reason: dispute.reason,
    status: dispute.status,
    openedById: dispute.openedById,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const disputes = await prisma.dispute.findMany({
    where: {
      openedById: session.user.id,
      status: "OPEN",
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      vertical: true,
      referenceId: true,
      reason: true,
      status: true,
      openedById: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(disputes.map((dispute) => serializeDispute(dispute)));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const verticalValue = normalizeString(body.vertical).toUpperCase();
  const referenceId = normalizeString(body.referenceId);
  const reason = normalizeString(body.reason).slice(0, 1200);

  if (!isVertical(verticalValue)) {
    return NextResponse.json({ error: "Invalid vertical" }, { status: 400 });
  }

  if (!referenceId || !reason) {
    return NextResponse.json(
      { error: "referenceId and reason are required" },
      { status: 400 }
    );
  }

  const isAdmin = session.user.role === "ADMIN";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const existingOpen = await tx.dispute.findFirst({
        where: {
          openedById: session.user.id,
          referenceId,
          status: { in: ["OPEN", "IN_REVIEW"] },
        },
        select: { id: true },
      });

      if (existingOpen) {
        throw new Error("DISPUTE_ALREADY_OPEN");
      }

      let payoutHoldCount = 0;

      if (verticalValue === Vertical.PRESTA) {
        const booking = await tx.prestaBooking.findFirst({
          where: { orderId: referenceId },
          select: {
            id: true,
            customerId: true,
            providerId: true,
          },
        });

        if (!booking) {
          throw new Error("REFERENCE_NOT_FOUND");
        }

        const canOpenDispute =
          isAdmin ||
          booking.customerId === session.user.id ||
          booking.providerId === session.user.id;

        if (!canOpenDispute) {
          throw new Error("FORBIDDEN_REFERENCE");
        }

        const holdResult = await tx.payout.updateMany({
          where: {
            orderId: referenceId,
            status: "PENDING",
          },
          data: {
            status: "HOLD",
          },
        });

        payoutHoldCount = holdResult.count;
      }

      if (verticalValue === Vertical.SHOP) {
        const order = await tx.order.findUnique({
          where: { id: referenceId },
          select: {
            id: true,
            userId: true,
            seller: {
              select: {
                userId: true,
              },
            },
          },
        });

        if (!order) {
          throw new Error("REFERENCE_NOT_FOUND");
        }

        const canOpenDispute =
          isAdmin ||
          order.userId === session.user.id ||
          order.seller?.userId === session.user.id;

        if (!canOpenDispute) {
          throw new Error("FORBIDDEN_REFERENCE");
        }

        const holdResult = await tx.payout.updateMany({
          where: {
            orderId: referenceId,
            status: "PENDING",
          },
          data: {
            status: "HOLD",
          },
        });

        payoutHoldCount = holdResult.count;
      }

      const dispute = await tx.dispute.create({
        data: {
          vertical: verticalValue,
          referenceId,
          reason,
          status: "OPEN",
          openedById: session.user.id,
        },
      });

      return {
        dispute,
        payoutHoldCount,
      };
    });

    return NextResponse.json(
      {
        dispute: serializeDispute(created.dispute),
        payoutHoldCount: created.payoutHoldCount,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "DISPUTE_ALREADY_OPEN") {
      return NextResponse.json(
        { error: "An OPEN or IN_REVIEW dispute already exists for this reference." },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "REFERENCE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Order reference not found for this vertical." },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN_REFERENCE") {
      return NextResponse.json(
        { error: "You are not allowed to open a dispute for this reference." },
        { status: 403 }
      );
    }

    throw error;
  }
}
