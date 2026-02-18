import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GpBookingStatus, GpTripStatus, PaymentMethod, UserRole } from "@prisma/client";

const allowedPaymentMethods = new Set<PaymentMethod>(Object.values(PaymentMethod));
const allowedStatuses = new Set<GpTripStatus>(Object.values(GpTripStatus));
const contactUnlockStatuses = new Set<GpBookingStatus>([
  GpBookingStatus.CONFIRMED,
  GpBookingStatus.COMPLETED,
  GpBookingStatus.DELIVERED,
]);
const contactUnlockStatusHint = "CONFIRMED|COMPLETED|DELIVERED";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseDate(value: unknown) {
  const raw = normalizeString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function parsePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((entry) => normalizeString(entry).toUpperCase())
    .filter(Boolean)
    .filter((entry): entry is PaymentMethod => allowedPaymentMethods.has(entry as PaymentMethod));

  const unique = Array.from(new Set(normalized));
  return unique;
}

async function loadTrip(id: string) {
  return prisma.gpTrip.findUnique({
    where: { id },
    include: {
      transporter: {
        select: {
          id: true,
          name: true,
          phone: true,
          transporterRating: true,
          transporterReviewCount: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });
}

function canManageTrip(sessionUserId: string, role: UserRole, transporterId: string) {
  if (role === UserRole.ADMIN) return true;
  return sessionUserId === transporterId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trip = await loadTrip(id);

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const isPublicTrip = trip.isActive && trip.status === GpTripStatus.OPEN;

  if (!isPublicTrip) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageTrip(session.user.id, session.user.role as UserRole, trip.transporterId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const viewerId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const isOwner = viewerId === trip.transporterId;

  let hasUnlockedBooking = false;
  if (viewerId && !isAdmin && !isOwner) {
    const unlockedBooking = await prisma.gpTripBooking.findFirst({
      where: {
        tripId: trip.id,
        customerId: viewerId,
        status: { in: Array.from(contactUnlockStatuses) },
      },
      select: { id: true },
    });

    hasUnlockedBooking = Boolean(unlockedBooking);
  }

  const canRevealContact = Boolean(isAdmin || isOwner || hasUnlockedBooking);
  const responseTrip = {
    ...trip,
    contactLocked: !canRevealContact,
    contactUnlockStatusHint,
  };

  if (canRevealContact) {
    return NextResponse.json(responseTrip);
  }

  const { contactPhone: _contactPhone, ...tripWithoutContact } = responseTrip;
  const { phone: _transporterPhone, ...transporterWithoutPhone } = trip.transporter;
  return NextResponse.json({
    ...tripWithoutContact,
    transporter: transporterWithoutPhone,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.gpTrip.findUnique({
    where: { id },
    select: { id: true, transporterId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userRole = session.user.role as UserRole;
  const isAdmin = userRole === UserRole.ADMIN;

  if (!canManageTrip(session.user.id, userRole, existing.transporterId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.originCity !== undefined) data.originCity = normalizeString(body.originCity);
  if (body.originAddress !== undefined) data.originAddress = normalizeString(body.originAddress);
  if (body.destinationCity !== undefined) data.destinationCity = normalizeString(body.destinationCity);
  if (body.destinationAddress !== undefined) data.destinationAddress = normalizeString(body.destinationAddress);
  if (body.airline !== undefined) data.airline = normalizeString(body.airline);
  if (body.flightNumber !== undefined) data.flightNumber = normalizeString(body.flightNumber).toUpperCase();

  if (body.flightDate !== undefined) {
    const parsed = parseDate(body.flightDate);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid flightDate" }, { status: 400 });
    }
    data.flightDate = parsed;
  }

  if (body.deliveryStartAt !== undefined) {
    const parsed = parseDate(body.deliveryStartAt);
    data.deliveryStartAt = parsed;
  }

  if (body.deliveryEndAt !== undefined) {
    const parsed = parseDate(body.deliveryEndAt);
    data.deliveryEndAt = parsed;
  }

  if (body.availableKg !== undefined) {
    const parsed = parsePositiveInt(body.availableKg);
    if (!parsed || parsed > 200) {
      return NextResponse.json({ error: "Invalid availableKg" }, { status: 400 });
    }
    data.availableKg = parsed;
  }

  if (body.pricePerKgCents !== undefined) {
    const parsed = parsePositiveInt(body.pricePerKgCents);
    if (!parsed || parsed > 1_000_000) {
      return NextResponse.json({ error: "Invalid pricePerKgCents" }, { status: 400 });
    }
    data.pricePerKgCents = parsed;
  }

  if (body.maxPackages !== undefined) {
    if (body.maxPackages === null || body.maxPackages === "") {
      data.maxPackages = null;
    } else {
      const parsed = parsePositiveInt(body.maxPackages);
      if (!parsed || parsed > 1000) {
        return NextResponse.json({ error: "Invalid maxPackages" }, { status: 400 });
      }
      data.maxPackages = parsed;
    }
  }

  if (body.acceptedPaymentMethods !== undefined) {
    const parsed = parsePaymentMethods(body.acceptedPaymentMethods);
    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        { error: "At least one accepted payment method is required" },
        { status: 400 }
      );
    }
    data.acceptedPaymentMethods = parsed;
  }

  if (body.contactPhone !== undefined) {
    data.contactPhone = normalizeString(body.contactPhone) || null;
  }

  if (body.notes !== undefined) {
    data.notes = normalizeString(body.notes) || null;
  }

  if (body.status !== undefined) {
    const parsedStatus = normalizeString(body.status).toUpperCase();
    if (!allowedStatuses.has(parsedStatus as GpTripStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = parsedStatus as GpTripStatus;

    if (parsedStatus === GpTripStatus.OPEN) {
      data.isActive = true;
    } else {
      data.isActive = false;
    }
  }

  if (body.isActive !== undefined) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admin can set isActive directly" },
        { status: 403 }
      );
    }
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  if (
    data.deliveryStartAt instanceof Date &&
    data.deliveryEndAt instanceof Date &&
    data.deliveryEndAt < data.deliveryStartAt
  ) {
    return NextResponse.json(
      { error: "deliveryEndAt must be after deliveryStartAt" },
      { status: 400 }
    );
  }

  const updated = await prisma.gpTrip.update({
    where: { id: existing.id },
    data,
    include: {
      transporter: {
        select: {
          id: true,
          name: true,
          phone: true,
          transporterRating: true,
          transporterReviewCount: true,
        },
      },
      store: { select: { id: true, slug: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.gpTrip.findUnique({
    where: { id },
    select: { id: true, transporterId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userRole = session.user.role as UserRole;
  if (!canManageTrip(session.user.id, userRole, existing.transporterId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.gpTrip.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
