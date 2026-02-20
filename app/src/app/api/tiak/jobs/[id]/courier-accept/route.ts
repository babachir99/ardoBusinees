import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const runtimePrisma = prisma as unknown as { tiakDelivery?: unknown };
  if (!runtimePrisma.tiakDelivery) {
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
        status: true,
        courierId: true,
        assignExpiresAt: true,
      },
    });

    if (!job) {
      return errorResponse(404, "JOB_NOT_FOUND", "Tiak job not found.");
    }

    const isAdmin = session.user.role === "ADMIN";
    const isAssignedCourier = session.user.id === job.courierId;
    if (!isAdmin && !isAssignedCourier) {
      return errorResponse(403, "FORBIDDEN", "Only assigned courier or admin can accept.");
    }

    const expectedCourierId = isAdmin ? job.courierId : session.user.id;
    if (!expectedCourierId) {
      return errorResponse(409, "JOB_NOT_ASSIGNED", "Job has no assigned courier.");
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const expired = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "ASSIGNED",
          courierId: expectedCourierId,
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

        return { state: "expired" as const };
      }

      const accepted = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "ASSIGNED",
          courierId: expectedCourierId,
          assignExpiresAt: { gt: now },
        },
        data: {
          assignExpiresAt: null,
        },
      });

      if (accepted.count === 0) {
        return { state: "conflict" as const };
      }

      await tx.tiakDeliveryEvent.create({
        data: {
          deliveryId: job.id,
          status: "ACCEPTED",
          note: "Courier accepted assignment",
          actorId: session.user.id,
        },
      });

      return { state: "accepted" as const };
    });

    if (result.state === "expired") {
      return errorResponse(409, "ASSIGNMENT_EXPIRED", "Assignment has expired.");
    }

    if (result.state === "conflict") {
      return errorResponse(409, "JOB_NOT_OPEN", "Job is no longer assignable.");
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: "ACCEPTED",
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

