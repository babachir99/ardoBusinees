import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeCourierId(value: unknown) {
  return String(value ?? "").trim();
}

export async function PATCH(
  request: NextRequest,
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const courierId = normalizeCourierId((body as { courierId?: unknown }).courierId);
  if (!courierId) {
    return errorResponse(400, "COURIER_ID_REQUIRED", "courierId is required.");
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
      },
    });

    if (!job) {
      return errorResponse(404, "JOB_NOT_FOUND", "Tiak job not found.");
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = session.user.id === job.customerId;

    if (!isAdmin && !isOwner) {
      return errorResponse(403, "FORBIDDEN", "Only owner or admin can assign courier.");
    }

    const courier = await prisma.tiakCourierProfile.findFirst({
      where: {
        courierId,
        isActive: true,
      },
      select: {
        courierId: true,
        courier: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!courier) {
      return errorResponse(404, "COURIER_NOT_FOUND", "Courier profile not found or inactive.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.tiakDelivery.updateMany({
        where: {
          id: job.id,
          status: "REQUESTED",
        },
        data: {
          status: "ACCEPTED",
          courierId: courier.courierId,
        },
      });

      if (updated.count === 0) {
        return { updated: false as const };
      }

      await tx.tiakDeliveryEvent.create({
        data: {
          deliveryId: job.id,
          status: "ACCEPTED",
          note: "Auto-assigned courier",
          actorId: session.user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: courier.courierId,
          action: "TIAK_JOB_ASSIGNED",
          entityType: "TiakDelivery",
          entityId: job.id,
          metadata: {
            assignedById: session.user.id,
          },
        },
      });

      return { updated: true as const };
    });

    if (!result.updated) {
      return errorResponse(409, "JOB_NOT_OPEN", "Job is no longer open for assignment.");
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: "ACCEPTED",
        assignedCourierId: courier.courierId,
      },
      courier: courier.courier,
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

