import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEitherBlocked } from "@/lib/trust-blocks";
import { GpBookingStatus, GpTripStatus, UserRole } from "@prisma/client";
import { assertSameOrigin } from "@/lib/request-security";

const contactUnlockStatuses = new Set<GpBookingStatus>([
  GpBookingStatus.CONFIRMED,
  GpBookingStatus.COMPLETED,
  GpBookingStatus.DELIVERED,
]);
const contactUnlockStatusHint = "CONFIRMED|COMPLETED|DELIVERED";
const carrierDecisionStatuses = new Set<GpBookingStatus>([
  GpBookingStatus.ACCEPTED,
  GpBookingStatus.REJECTED,
]);

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function normalizeMessage(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 1200);
}

function canUnlockContact(status: GpBookingStatus | null | undefined) {
  return Boolean(status && contactUnlockStatuses.has(status));
}

function canManageBooking(userId: string, role: UserRole, transporterId: string) {
  if (role === UserRole.ADMIN) return true;
  return userId === transporterId;
}

function generateShipmentCode(bookingId: string) {
  return `GP-${bookingId.slice(0, 8).toUpperCase()}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [trip, booking] = await Promise.all([
    prisma.gpTrip.findUnique({
      where: { id },
      select: {
        id: true,
        transporterId: true,
        contactPhone: true,
        transporter: { select: { phone: true } },
      },
    }),
    prisma.gpTripBooking.findUnique({
      where: {
        tripId_customerId: {
          tripId: id,
          customerId: session.user.id,
        },
      },
      select: {
        id: true,
        tripId: true,
        status: true,
        requestedKg: true,
        packageCount: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        confirmedAt: true,
        completedAt: true,
      },
    }),
  ]);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === UserRole.ADMIN;
  const isOwner = trip.transporterId === session.user.id;
  const blockedInteraction = !isAdmin && !isOwner ? await isEitherBlocked(session.user.id, trip.transporterId) : false;
  const canContact = Boolean(!blockedInteraction && (isAdmin || isOwner || canUnlockContact(booking?.status)));

  return NextResponse.json({
    booking,
    canContact,
    contactLocked: !canContact,
    contactUnlockStatusHint: blockedInteraction ? "BLOCKED_USER" : contactUnlockStatusHint,
    ...(canContact
      ? {
          contactPhone: trip.contactPhone ?? trip.transporter.phone ?? null,
        }
      : {}),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) {
    return csrfBlocked;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestedKg = parsePositiveInt(body.requestedKg);
  const packageCount = parsePositiveInt(body.packageCount);
  const message = normalizeMessage(body.message);

  if (!requestedKg || !packageCount) {
    return NextResponse.json(
      { error: "requestedKg and packageCount are required" },
      { status: 400 }
    );
  }

  const trip = await prisma.gpTrip.findUnique({
    where: { id },
    select: {
      id: true,
      transporterId: true,
      availableKg: true,
      isActive: true,
      status: true,
      contactPhone: true,
      transporter: { select: { phone: true } },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (!trip.isActive || trip.status !== GpTripStatus.OPEN) {
    return NextResponse.json({ error: "Trip is not open for booking" }, { status: 400 });
  }

  if (trip.transporterId === session.user.id) {
    return NextResponse.json({ error: "Cannot book your own trip" }, { status: 403 });
  }

  if (await isEitherBlocked(session.user.id, trip.transporterId)) {
    return NextResponse.json({ error: "BLOCKED_USER", message: "Interaction blocked by user safety settings." }, { status: 403 });
  }

  if (requestedKg > trip.availableKg) {
    return NextResponse.json({ error: "Requested weight exceeds available kg" }, { status: 400 });
  }

  if (packageCount > 200) {
    return NextResponse.json({ error: "packageCount must be <= 200" }, { status: 400 });
  }

  const booking = await prisma.gpTripBooking.upsert({
    where: {
      tripId_customerId: {
        tripId: trip.id,
        customerId: session.user.id,
      },
    },
    create: {
      tripId: trip.id,
      customerId: session.user.id,
      transporterId: trip.transporterId,
      status: GpBookingStatus.PENDING,
      requestedKg,
      packageCount,
      message,
    },
    update: {
      status: GpBookingStatus.PENDING,
      requestedKg,
      packageCount,
      message,
      confirmedAt: null,
      completedAt: null,
    },
    select: {
      id: true,
      tripId: true,
      status: true,
      requestedKg: true,
      packageCount: true,
      message: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const canContact = canUnlockContact(booking.status);

  return NextResponse.json(
    {
      booking,
      canContact,
      contactLocked: !canContact,
      contactUnlockStatusHint,
      ...(canContact
        ? {
            contactPhone: trip.contactPhone ?? trip.transporter.phone ?? null,
          }
        : {}),
    },
    { status: 201 }
  );
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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  const nextStatusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const nextStatus = nextStatusRaw as GpBookingStatus;

  if (!bookingId || !carrierDecisionStatuses.has(nextStatus)) {
    return NextResponse.json({ error: "bookingId and status are required" }, { status: 400 });
  }

  const booking = await prisma.gpTripBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      tripId: true,
      transporterId: true,
      customerId: true,
      requestedKg: true,
      status: true,
      shipment: {
        select: {
          id: true,
          code: true,
          status: true,
        },
      },
      trip: {
        select: {
          id: true,
          isActive: true,
          status: true,
          availableKg: true,
          originCity: true,
          destinationCity: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!booking || booking.tripId !== id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const userRole = session.user.role as UserRole;
  if (!canManageBooking(session.user.id, userRole, booking.transporterId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status === nextStatus) {
    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
      },
      shipment: booking.shipment,
      ok: true,
    });
  }

  if (booking.status !== GpBookingStatus.PENDING) {
    return NextResponse.json(
      { error: "Only pending bookings can be updated from the dashboard" },
      { status: 409 }
    );
  }

  if (!booking.trip.isActive || booking.trip.status !== GpTripStatus.OPEN) {
    return NextResponse.json(
      { error: "Trip is no longer open for booking decisions" },
      { status: 409 }
    );
  }

  if (nextStatus === GpBookingStatus.ACCEPTED) {
    const reservedAggregate = await prisma.gpTripBooking.aggregate({
      where: {
        tripId: booking.tripId,
        id: { not: booking.id },
        status: {
          in: [
            GpBookingStatus.ACCEPTED,
            GpBookingStatus.CONFIRMED,
            GpBookingStatus.COMPLETED,
            GpBookingStatus.DELIVERED,
          ],
        },
      },
      _sum: { requestedKg: true },
    });

    const reservedKg = reservedAggregate._sum.requestedKg ?? 0;
    if (reservedKg + booking.requestedKg > booking.trip.availableKg) {
      return NextResponse.json(
        {
          error: "Trip capacity exceeded",
          reservedKg,
          availableKg: booking.trip.availableKg,
          requestedKg: booking.requestedKg,
        },
        { status: 409 }
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.gpTripBooking.update({
      where: { id: booking.id },
      data: {
        status: nextStatus,
        confirmedAt: null,
        completedAt: null,
      },
      select: {
        id: true,
        status: true,
        requestedKg: true,
        packageCount: true,
        updatedAt: true,
      },
    });

    let shipment = booking.shipment;

    if (nextStatus === GpBookingStatus.ACCEPTED && !shipment) {
      shipment = await tx.gpShipment.create({
        data: {
          bookingId: booking.id,
          tripId: booking.tripId,
          senderId: booking.customerId,
          receiverId: null,
          transporterId: booking.transporterId,
          code: generateShipmentCode(booking.id),
          fromCity: booking.trip.originCity,
          toCity: booking.trip.destinationCity,
          weightKg: booking.requestedKg,
          status: "DROPPED_OFF",
          note: booking.customer.name
            ? `Booking accepted for ${booking.customer.name}`
            : "Booking accepted",
        },
        select: {
          id: true,
          code: true,
          status: true,
        },
      });

      await tx.gpShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: "DROPPED_OFF",
          note: "Booking accepted",
          actorId: session.user.id,
        },
      });
    }

    return {
      booking: updatedBooking,
      shipment,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
