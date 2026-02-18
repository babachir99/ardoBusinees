import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GpBookingStatus, GpTripStatus, UserRole } from "@prisma/client";

const contactUnlockStatuses = new Set<GpBookingStatus>([
  GpBookingStatus.CONFIRMED,
  GpBookingStatus.COMPLETED,
  GpBookingStatus.DELIVERED,
]);
const contactUnlockStatusHint = "CONFIRMED|COMPLETED|DELIVERED";

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
  const canContact = Boolean(isAdmin || isOwner || canUnlockContact(booking?.status));

  return NextResponse.json({
    booking,
    canContact,
    contactLocked: !canContact,
    contactUnlockStatusHint,
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
