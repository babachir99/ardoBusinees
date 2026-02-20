import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GpBookingStatus, GpTripStatus, PaymentMethod, UserRole } from "@prisma/client";
import { hasAnyUserRole, hasUserRole } from "@/lib/userRoles";

const allowedPaymentMethods = new Set<PaymentMethod>(Object.values(PaymentMethod));
const allowedStatuses = new Set<GpTripStatus>(Object.values(GpTripStatus));
const allowedCurrencies = new Set(["XOF", "EUR", "USD"] as const);
const contactUnlockStatuses = new Set<GpBookingStatus>([
  GpBookingStatus.CONFIRMED,
  GpBookingStatus.COMPLETED,
  GpBookingStatus.DELIVERED,
]);
const contactUnlockStatusHint = "CONFIRMED|COMPLETED|DELIVERED";

type TripCurrency = "XOF" | "EUR" | "USD";

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

function parsePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((entry) => normalizeString(entry).toUpperCase())
    .filter(Boolean)
    .filter((entry): entry is PaymentMethod => allowedPaymentMethods.has(entry as PaymentMethod));

  return Array.from(new Set(normalized));
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function parseCurrency(value: unknown): TripCurrency | null {
  const raw = normalizeString(value).toUpperCase();
  if (!raw) return null;
  if (!allowedCurrencies.has(raw as TripCurrency)) return null;
  return raw as TripCurrency;
}

async function getGpStoreId() {
  const store = await prisma.store.findUnique({
    where: { slug: "jontaado-gp" },
    select: { id: true, isActive: true },
  });

  if (!store || !store.isActive) {
    return null;
  }

  return store.id;
}

function shouldIncludeContact(request: NextRequest) {
  return new URL(request.url).searchParams.get("includeContact") === "1";
}

function stripForbiddenContactKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripForbiddenContactKeys(entry));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(source)) {
      if (key === "phone" || key === "contactPhone") {
        continue;
      }
      next[key] = stripForbiddenContactKeys(nestedValue);
    }

    return next;
  }

  return value;
}

function sanitizeTripContact(
  trip: Record<string, unknown>,
  canRevealContact: boolean
) {
  const withLockMeta = {
    ...trip,
    contactLocked: !canRevealContact,
    contactUnlockStatusHint,
  };

  if (canRevealContact) {
    return withLockMeta;
  }

  return stripForbiddenContactKeys(withLockMeta) as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);

  const mine = searchParams.get("mine") === "1";
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 100) : 20;

  const from = normalizeString(searchParams.get("from"));
  const to = normalizeString(searchParams.get("to"));
  const q = normalizeString(searchParams.get("q"));
  const transporterIdFilter = normalizeString(searchParams.get("transporterId"));

  const departureDate = normalizeString(searchParams.get("departureDate"));
  const flightDateFrom = parseDate(searchParams.get("flightDateFrom"));
  const flightDateTo = parseDate(searchParams.get("flightDateTo"));

  const currencyRaw = normalizeString(searchParams.get("currency")).toUpperCase();
  const selectedCurrency = allowedCurrencies.has(currencyRaw as TripCurrency)
    ? (currencyRaw as TripCurrency)
    : null;

  const minPrice = parsePositiveInt(searchParams.get("minPrice"));
  const maxPrice = parsePositiveInt(searchParams.get("maxPrice"));

  const where: Record<string, unknown> = {};

  if (mine) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (hasUserRole(session.user, "ADMIN")) {
      if (transporterIdFilter) {
        where.transporterId = transporterIdFilter;
      }
    } else {
      where.transporterId = session.user.id;
    }
  } else {
    where.isActive = true;
    where.status = GpTripStatus.OPEN;
  }

  if (from) {
    where.originCity = { contains: from, mode: "insensitive" };
  }

  if (to) {
    where.destinationCity = { contains: to, mode: "insensitive" };
  }

  if (q) {
    where.OR = [
      { originCity: { contains: q, mode: "insensitive" } },
      { destinationCity: { contains: q, mode: "insensitive" } },
      { airline: { contains: q, mode: "insensitive" } },
      { flightNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  if (departureDate) {
    const start = new Date(`${departureDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.flightDate = { gte: start, lt: end };
    }
  } else if (flightDateFrom || flightDateTo) {
    where.flightDate = {
      ...(flightDateFrom ? { gte: flightDateFrom } : {}),
      ...(flightDateTo ? { lte: flightDateTo } : {}),
    };
  }

  if (selectedCurrency) {
    where.currency = selectedCurrency;

    if (minPrice || maxPrice) {
      where.pricePerKgCents = {
        ...(minPrice ? { gte: minPrice } : {}),
        ...(maxPrice ? { lte: maxPrice } : {}),
      };
    }
  }

  const trips = await prisma.gpTrip.findMany({
    where,
    take,
    orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
    include: {
      transporter: {
        select: {
          id: true,
          name: true,
          transporterRating: true,
          transporterReviewCount: true,
          phone: true,
        },
      },
      store: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  const isAdmin = hasUserRole(session?.user, "ADMIN");
  const viewerId = session?.user?.id ?? null;

  let unlockedTripIds = new Set<string>();
  if (viewerId && !isAdmin && trips.length > 0) {
    const customerBookings = await prisma.gpTripBooking.findMany({
      where: {
        customerId: viewerId,
        tripId: { in: trips.map((trip) => trip.id) },
        status: { in: Array.from(contactUnlockStatuses) },
      },
      select: { tripId: true },
    });
    unlockedTripIds = new Set(customerBookings.map((booking) => booking.tripId));
  }

  const safeTrips = trips.map((trip) => {
    const isOwner = viewerId === trip.transporterId;
    const canRevealContact = Boolean(isAdmin || isOwner || unlockedTripIds.has(trip.id));
    return sanitizeTripContact(trip as unknown as Record<string, unknown>, canRevealContact);
  });

  return NextResponse.json(safeTrips);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = hasUserRole(session.user, "ADMIN");
  const isTransporter = hasAnyUserRole(session.user, ["TRANSPORTER", "GP_CARRIER", "ADMIN"]);

  if (!isAdmin && !isTransporter) {
    return NextResponse.json(
      { error: "Only GP transporters can publish a trip." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gpStoreId = await getGpStoreId();
  if (!gpStoreId) {
    return NextResponse.json({ error: "GP store is unavailable" }, { status: 400 });
  }

  const requestedTransporterId = normalizeString(body.transporterId);
  const transporterId = isAdmin && requestedTransporterId ? requestedTransporterId : session.user.id;

  const transporter = await prisma.user.findUnique({
    where: { id: transporterId },
    select: {
      id: true,
      role: true,
      phone: true,
      roleAssignments: {
        where: { status: "ACTIVE" },
        select: { role: true },
      },
    },
  });

  if (!transporter) {
    return NextResponse.json({ error: "Transporter not found" }, { status: 404 });
  }

  const transporterCanPublish =
    transporter.role === UserRole.TRANSPORTER ||
    transporter.roleAssignments.some(
      (roleEntry) => roleEntry.role === "GP_CARRIER" || roleEntry.role === "ADMIN"
    );

  if (!isAdmin && !transporterCanPublish) {
    return NextResponse.json({ error: "Invalid transporter profile" }, { status: 403 });
  }

  const originCity = normalizeString(body.originCity);
  const originAddress = normalizeString(body.originAddress);
  const destinationCity = normalizeString(body.destinationCity);
  const destinationAddress = normalizeString(body.destinationAddress);

  const departureDate = parseDate(body.departureDate ?? body.flightDate);
  const arrivalDate = parseDate(body.arrivalDate);

  const airline = normalizeString(body.airline) || "GP";
  const flightNumber = normalizeString(body.flightNumber).toUpperCase() || "N/A";

  const deliveryStartAt = parseDate(body.deliveryStartAt);
  const deliveryEndAt = parseDate(body.deliveryEndAt);

  const availableKg = parsePositiveInt(body.availableKg);
  const pricePerKgCents = parsePositiveInt(body.price ?? body.pricePerKgCents);
  const currency = parseCurrency(body.currency) ?? "XOF";

  const maxPackages = body.maxPackages === undefined || body.maxPackages === null
    ? null
    : parsePositiveInt(body.maxPackages);
  const contactPhone = normalizeString(body.contactPhone) || transporter.phone || null;
  const notes = normalizeString(body.notes);

  const acceptedPaymentMethods = parsePaymentMethods(body.acceptedPaymentMethods);

  if (
    !originCity ||
    !originAddress ||
    !destinationCity ||
    !destinationAddress ||
    !departureDate ||
    !availableKg ||
    !pricePerKgCents
  ) {
    return NextResponse.json(
      {
        error:
          "originCity, originAddress, destinationCity, destinationAddress, departureDate, availableKg and price are required",
      },
      { status: 400 }
    );
  }

  if (arrivalDate && arrivalDate < departureDate) {
    return NextResponse.json(
      { error: "arrivalDate must be after or equal to departureDate" },
      { status: 400 }
    );
  }

  if (acceptedPaymentMethods.length === 0) {
    return NextResponse.json(
      { error: "At least one accepted payment method is required" },
      { status: 400 }
    );
  }

  if (availableKg > 200) {
    return NextResponse.json({ error: "availableKg must be <= 200" }, { status: 400 });
  }

  if (pricePerKgCents > 1_000_000) {
    return NextResponse.json({ error: "price is too high" }, { status: 400 });
  }

  if (maxPackages !== null && maxPackages > 1000) {
    return NextResponse.json({ error: "maxPackages must be <= 1000" }, { status: 400 });
  }

  const effectiveDeliveryEndAt = arrivalDate ?? deliveryEndAt;

  if (deliveryStartAt && effectiveDeliveryEndAt && effectiveDeliveryEndAt < deliveryStartAt) {
    return NextResponse.json(
      { error: "deliveryEndAt must be after deliveryStartAt" },
      { status: 400 }
    );
  }

  const statusInput = normalizeString(body.status).toUpperCase();
  const status =
    isAdmin && allowedStatuses.has(statusInput as GpTripStatus)
      ? (statusInput as GpTripStatus)
      : GpTripStatus.OPEN;

  const trip = await prisma.gpTrip.create({
    data: {
      transporterId,
      storeId: gpStoreId,
      originCity,
      originAddress,
      destinationCity,
      destinationAddress,
      airline,
      flightNumber,
      flightDate: departureDate,
      deliveryStartAt,
      deliveryEndAt: effectiveDeliveryEndAt,
      availableKg,
      pricePerKgCents,
      currency,
      maxPackages,
      acceptedPaymentMethods,
      contactPhone,
      notes: notes || null,
      status,
      isActive: status === GpTripStatus.OPEN,
    },
    include: {
      transporter: {
        select: { id: true, name: true, phone: true },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  const includeContact = shouldIncludeContact(request);
  const canRevealContact = includeContact && (isAdmin || session.user.id === trip.transporterId);

  return NextResponse.json(
    sanitizeTripContact(trip as unknown as Record<string, unknown>, canRevealContact),
    { status: 201 }
  );
}
