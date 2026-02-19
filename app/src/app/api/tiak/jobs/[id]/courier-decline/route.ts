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
      },
    });

    if (!job) {
      return errorResponse(404, "JOB_NOT_FOUND", "Tiak job not found.");
    }

    const isAdmin = session.user.role === "ADMIN";
    const isAssignedCourier = session.user.id === job.courierId;
    if (!isAdmin && !isAssignedCourier) {
      return errorResponse(403, "FORBIDDEN", "Only assigned courier or admin can decline.");
    }

    const updated = await prisma.tiakDelivery.updateMany({
      where: {
        id: job.id,
        status: "REQUESTED",
        courierId: job.courierId,
      },
      data: {
        courierId: null,
        assignedAt: null,
        assignExpiresAt: null,
      },
    });

    if (updated.count === 0) {
      return errorResponse(409, "JOB_NOT_OPEN", "Job is no longer assignable.");
    }

    await prisma.tiakDeliveryEvent.create({
      data: {
        deliveryId: job.id,
        status: "REQUESTED",
        note: "Courier declined assignment",
        actorId: session.user.id,
      },
    });

    return NextResponse.json({
      job: {
        id: job.id,
        status: "OPEN",
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

