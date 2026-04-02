import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const activeStatuses = ["DROPPED_OFF", "PICKED_UP", "BOARDED", "ARRIVED"] as const;
const bookingStatusesForSync = ["ACCEPTED", "CONFIRMED", "COMPLETED", "DELIVERED"] as const;

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function isAllowedRole(role: string | undefined) {
  return ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER"].includes(role ?? "");
}

function mapBookingStatusToShipmentStatus(status: string) {
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "COMPLETED") return "ARRIVED";
  if (status === "CONFIRMED") return "PICKED_UP";
  return "DROPPED_OFF";
}

function generateShipmentCode(bookingId: string) {
  return `GP-${bookingId.slice(0, 8).toUpperCase()}`;
}

async function syncShipmentsForTransporter(transporterId: string) {
  const runtimePrisma = prisma as unknown as {
    gpShipment?: {
      findMany: (args: unknown) => Promise<Array<{ bookingId: string | null }>>;
      create: (args: unknown) => Promise<unknown>;
    };
    gpShipmentEvent?: {
      create: (args: unknown) => Promise<unknown>;
    };
  };

  if (!runtimePrisma.gpShipment || !runtimePrisma.gpShipmentEvent) {
    return;
  }

  const bookings = await prisma.gpTripBooking.findMany({
    where: {
      transporterId,
      status: { in: [...bookingStatusesForSync] },
    },
    select: {
      id: true,
      customerId: true,
      transporterId: true,
      requestedKg: true,
      status: true,
      message: true,
      trip: {
        select: {
          id: true,
          originCity: true,
          destinationCity: true,
        },
      },
    },
    take: 100,
  });

  if (bookings.length === 0) return;

  const existing = await runtimePrisma.gpShipment.findMany({
    where: {
      bookingId: { in: bookings.map((booking) => booking.id) },
    },
    select: { bookingId: true },
  });

  const existingBookingIds = new Set(existing.map((row) => row.bookingId).filter((id): id is string => Boolean(id)));

  for (const booking of bookings) {
    if (existingBookingIds.has(booking.id)) continue;

    const mappedStatus = mapBookingStatusToShipmentStatus(booking.status);

    try {
      const created = await runtimePrisma.gpShipment.create({
        data: {
          bookingId: booking.id,
          tripId: booking.trip?.id ?? null,
          senderId: booking.customerId,
          receiverId: null,
          transporterId: booking.transporterId,
          code: generateShipmentCode(booking.id),
          fromCity: booking.trip?.originCity ?? "-",
          toCity: booking.trip?.destinationCity ?? "-",
          weightKg: booking.requestedKg,
          status: mappedStatus,
          note: booking.message ?? null,
        },
        select: { id: true },
      });

      await runtimePrisma.gpShipmentEvent.create({
        data: {
          shipmentId: (created as { id: string }).id,
          status: mappedStatus,
          note: "Initial shipment event",
          actorId: transporterId,
        },
      });
    } catch {
      // ignore race conditions and duplicate creations
    }
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (!isAllowedRole(session.user.role)) {
    return errorResponse(403, "FORBIDDEN", "Access restricted to GP transporters.");
  }

  const runtimePrisma = prisma as unknown as {
    gpShipment?: {
      findMany: (args: unknown) => Promise<unknown[]>;
    };
  };

  if (!runtimePrisma.gpShipment) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";
  const status = (searchParams.get("status") ?? "ACTIVE").toUpperCase();
  const take = normalizeTake(searchParams.get("take"), 20, 100);

  if (!mine && session.user.role !== "ADMIN") {
    return errorResponse(403, "FORBIDDEN", "Use mine=1 unless admin.");
  }

  try {
    if (mine && ["ADMIN", "TRANSPORTER", "GP_CARRIER"].includes(session.user.role ?? "")) {
      await syncShipmentsForTransporter(session.user.id);
    }

    const shipments = await runtimePrisma.gpShipment.findMany({
      where: {
        ...(mine
          ? {
              OR: [
                { transporterId: session.user.id },
                { senderId: session.user.id },
                { receiverId: session.user.id },
              ],
            }
          : { transporterId: session.user.id }),
        ...(status === "ACTIVE" ? { status: { in: [...activeStatuses] } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      select: {
        id: true,
        code: true,
        fromCity: true,
        toCity: true,
        weightKg: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(shipments);
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
