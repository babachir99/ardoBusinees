import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GpBookingStatus, UserRole } from "@prisma/client";

const MAX_TITLE = 80;
const MAX_COMMENT = 1200;
const contactUnlockStatuses = new Set<GpBookingStatus>([
  GpBookingStatus.CONFIRMED,
  GpBookingStatus.COMPLETED,
  GpBookingStatus.DELIVERED,
]);
const contactUnlockStatusHint = "CONFIRMED|COMPLETED|DELIVERED";

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

function normalizeText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

function normalizeRating(value: unknown) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  if (numeric < 1 || numeric > 5) return null;
  return numeric;
}

async function refreshTransporterRating(transporterId: string) {
  const stats = await prisma.transporterReview.aggregate({
    where: { transporterId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const count = stats._count._all;
  const rating = count > 0 && stats._avg.rating !== null ? stats._avg.rating : 5;

  await prisma.user.update({
    where: { id: transporterId },
    data: {
      transporterRating: rating,
      transporterReviewCount: count,
    },
  });

  return { rating, count };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const runtimePrisma = prisma as unknown as {
    transporterReview?: unknown;
    gpTrip?: unknown;
    gpTripBooking?: unknown;
  };

  if (!runtimePrisma.transporterReview || !runtimePrisma.gpTrip || !runtimePrisma.gpTripBooking) {
    return NextResponse.json(
      {
        error:
          "Transporter reviews temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const trip = await prisma.gpTrip.findUnique({
    where: { id },
    select: {
      id: true,
      transporterId: true,
      isActive: true,
      status: true,
      transporter: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
          transporterRating: true,
          transporterReviewCount: true,
        },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const [reviews, stats, myReview, myEligibleBooking, unlockedBooking] = await Promise.all([
    prisma.transporterReview.findMany({
      where: { tripId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        reviewer: {
          select: { id: true, name: true, image: true },
        },
      },
    }),
    prisma.transporterReview.aggregate({
      where: { tripId: id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    session?.user?.id
      ? prisma.transporterReview.findUnique({
          where: {
            tripId_reviewerId: {
              tripId: id,
              reviewerId: session.user.id,
            },
          },
        })
      : Promise.resolve(null),
    session?.user?.id
      ? prisma.gpTripBooking.findFirst({
          where: {
            tripId: id,
            customerId: session.user.id,
            status: { in: [GpBookingStatus.DELIVERED, GpBookingStatus.COMPLETED] },
          },
          select: { id: true, status: true },
        })
      : Promise.resolve(null),
    session?.user?.id
      ? prisma.gpTripBooking.findFirst({
          where: {
            tripId: id,
            customerId: session.user.id,
            status: { in: Array.from(contactUnlockStatuses) },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const canReview =
    Boolean(session?.user?.id) &&
    session?.user?.id !== trip.transporterId &&
    Boolean(myEligibleBooking);

  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const isOwner = session?.user?.id === trip.transporterId;
  const canRevealContact = Boolean(isAdmin || isOwner || unlockedBooking);

  const transporter = canRevealContact
    ? trip.transporter
    : (stripForbiddenContactKeys(trip.transporter) as {
        id: string;
        name: string | null;
        image: string | null;
        transporterRating: number;
        transporterReviewCount: number;
      });

  return NextResponse.json({
    tripId: trip.id,
    transporter,
    contactLocked: !canRevealContact,
    contactUnlockStatusHint,
    stats: {
      average: stats._avg.rating ?? 0,
      count: stats._count._all,
    },
    canReview,
    reviewLockedMessage: canReview
      ? null
      : "Tu pourras noter apres reception du colis.",
    myReview,
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: review.reviewer,
      mine: review.reviewerId === session?.user?.id,
    })),
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

  const runtimePrisma = prisma as unknown as {
    transporterReview?: unknown;
    gpTrip?: unknown;
    gpTripBooking?: unknown;
  };

  if (!runtimePrisma.transporterReview || !runtimePrisma.gpTrip || !runtimePrisma.gpTripBooking) {
    return NextResponse.json(
      {
        error:
          "Transporter reviews temporarily unavailable. Run npx prisma generate and restart dev server.",
      },
      { status: 503 }
    );
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const rating = normalizeRating(body?.rating);
  const title = normalizeText(body?.title, MAX_TITLE);
  const comment = normalizeText(body?.comment, MAX_COMMENT);

  if (rating === null) {
    return NextResponse.json({ error: "invalid rating" }, { status: 400 });
  }

  const trip = await prisma.gpTrip.findUnique({
    where: { id },
    select: {
      id: true,
      transporterId: true,
      isActive: true,
      status: true,
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (session.user.id === trip.transporterId) {
    return NextResponse.json({ error: "Cannot review your own trip" }, { status: 403 });
  }

  const deliveredBooking = await prisma.gpTripBooking.findFirst({
    where: {
      tripId: id,
      customerId: session.user.id,
      status: { in: [GpBookingStatus.DELIVERED, GpBookingStatus.COMPLETED] },
    },
    select: { id: true },
  });

  if (!deliveredBooking) {
    return NextResponse.json(
      { error: "Tu pourras noter apres reception du colis." },
      { status: 403 }
    );
  }

  const saved = await prisma.transporterReview.upsert({
    where: {
      tripId_reviewerId: {
        tripId: id,
        reviewerId: session.user.id,
      },
    },
    create: {
      tripId: id,
      transporterId: trip.transporterId,
      reviewerId: session.user.id,
      rating,
      title,
      comment,
    },
    update: {
      rating,
      title,
      comment,
    },
    include: {
      reviewer: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  const transporterStats = await refreshTransporterRating(trip.transporterId);

  return NextResponse.json(
    {
      id: saved.id,
      rating: saved.rating,
      title: saved.title,
      comment: saved.comment,
      createdAt: saved.createdAt,
      reviewer: saved.reviewer,
      mine: true,
      transporter: {
        id: trip.transporterId,
        rating: transporterStats.rating,
        reviewCount: transporterStats.count,
      },
    },
    { status: 201 }
  );
}
