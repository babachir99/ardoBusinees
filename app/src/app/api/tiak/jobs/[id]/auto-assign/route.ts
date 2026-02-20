import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreCouriersForDelivery } from "@/lib/tiak/matching";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: unknown;
    tiakCourierProfile?: unknown;
  };

  if (!runtimePrisma.tiakDelivery || !runtimePrisma.tiakCourierProfile) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;

  try {
    const job = await prisma.tiakDelivery.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        courierId: true,
        assignExpiresAt: true,
      },
    });

    if (!job) {
      return errorResponse(404, "JOB_NOT_FOUND", "Tiak job not found.");
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = session.user.id === job.customerId;
    if (!isAdmin && !isOwner) {
      return errorResponse(403, "FORBIDDEN", "Only owner or admin can auto-assign courier.");
    }

    const shortlist = await scoreCouriersForDelivery(job.id, 1);
    const winner = shortlist[0];

    if (!winner) {
      return errorResponse(409, "NO_COURIER_AVAILABLE", "No courier available for this job.");
    }

    const assignedAt = new Date();
    const assignExpiresAt = addMinutes(assignedAt, 5);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const expired = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "ASSIGNED",
          assignExpiresAt: { lte: now },
        },
        data: {
          status: "REQUESTED",
          courierId: null,
          assignedAt: null,
          assignExpiresAt: null,
        },
      });

      if (expired.count > 0) {
        await tx.tiakDeliveryEvent.create({
          data: {
            deliveryId: job.id,
            status: "REQUESTED",
            note: "Assignment expired",
            actorId: session.user.id,
          },
        });
      }

      const updated = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "REQUESTED",
          courierId: null,
        },
        data: {
          status: "ASSIGNED",
          courierId: winner.courierId,
          assignedAt,
          assignExpiresAt,
        },
      });

      if (updated.count === 0) {
        return { updated: false as const };
      }

      await tx.tiakDeliveryEvent.create({
        data: {
          deliveryId: job.id,
          status: "ASSIGNED",
          note: "Courier assigned",
          actorId: session.user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: winner.courierId,
          action: "TIAK_AUTO_ASSIGNED",
          entityType: "TiakDelivery",
          entityId: job.id,
          metadata: {
            assignedById: session.user.id,
            assignExpiresAt,
          },
        },
      });

      return { updated: true as const };
    });

    if (!result.updated) {
      return errorResponse(409, "JOB_NOT_OPEN", "Job already assigned or no longer open.");
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: "ASSIGNED",
        assignedCourierId: winner.courierId,
        assignExpiresAt,
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
