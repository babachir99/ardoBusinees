import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function isAllowedRole(role: string | undefined) {
  return ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER"].includes(role ?? "");
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (!isAllowedRole(session.user.role)) {
    return errorResponse(403, "FORBIDDEN", "Access restricted to GP transporters.");
  }

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";
  if (!mine && session.user.role !== "ADMIN") {
    return errorResponse(403, "FORBIDDEN", "Use mine=1 unless admin.");
  }

  const transporterId = mine ? session.user.id : session.user.id;

  try {
    const [tripsUpcoming, shipmentsActive, kilosSold, pendingRevenueRows] = await Promise.all([
      prisma.gpTrip.count({
        where: {
          transporterId,
          isActive: true,
          status: "OPEN",
          flightDate: { gte: new Date() },
        },
      }),
      prisma.gpTripBooking.count({
        where: {
          transporterId,
          status: { in: ["ACCEPTED", "CONFIRMED"] },
        },
      }),
      prisma.gpTripBooking.aggregate({
        _sum: { requestedKg: true },
        where: {
          transporterId,
          status: { in: ["CONFIRMED", "COMPLETED", "DELIVERED"] },
        },
      }),
      prisma.gpTripBooking.findMany({
        where: {
          transporterId,
          status: { in: ["ACCEPTED", "CONFIRMED"] },
        },
        select: {
          requestedKg: true,
          trip: { select: { pricePerKgCents: true } },
        },
      }),
    ]);

    const revenuePendingCents = pendingRevenueRows.reduce((sum, row) => {
      const pricePerKg = row.trip?.pricePerKgCents ?? 0;
      return sum + row.requestedKg * pricePerKg;
    }, 0);

    return NextResponse.json({
      kpis: {
        tripsUpcoming,
        shipmentsActive,
        kilosSold: kilosSold._sum.requestedKg ?? 0,
        revenuePendingCents,
        currency: "XOF",
      },
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
