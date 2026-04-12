import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrestaBookingStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertActionRateLimit } from "@/lib/action-rate-limit";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function hasReviewDelegates() {
  const runtimePrisma = prisma as unknown as {
    review?: unknown;
    prestaBooking?: unknown;
  };

  return Boolean(runtimePrisma.review && runtimePrisma.prestaBooking);
}

function isMissingMigrationError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return true;
  }

  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  return message.includes("table does not exist") || message.includes("relation does not exist");
}

function normalizeNonNegativeInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return normalized < 0 ? 0 : normalized;
}

function normalizeTake(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  const normalized = Math.trunc(parsed);
  if (normalized < 1) return 20;
  return Math.min(normalized, 50);
}

export async function GET(request: NextRequest) {
  if (!hasReviewDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Review delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const targetUserId = normalizeString(new URL(request.url).searchParams.get("targetUserId"));
  if (!targetUserId) {
    return errorResponse(400, "TARGET_USER_ID_REQUIRED", "targetUserId is required.");
  }

  const searchParams = new URL(request.url).searchParams;
  const take = normalizeTake(searchParams.get("take"));
  const skip = normalizeNonNegativeInt(searchParams.get("skip"), 0);

  try {
    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { targetUserId },
        orderBy: [{ createdAt: "desc" }],
        take,
        skip,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      }),
      prisma.review.aggregate({
        where: { targetUserId },
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ]);

    return NextResponse.json({
      reviews,
      meta: {
        count: aggregate._count._all,
        avgRating: aggregate._avg.rating,
      },
    });
  } catch (error) {
    if (isMissingMigrationError(error)) {
      return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
    }

    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}

export async function POST(request: NextRequest) {
  if (!hasReviewDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Review delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const bookingId = normalizeString((body as { bookingId?: unknown }).bookingId);
  const rawRating = (body as { rating?: unknown }).rating;
  const parsedRating = Number(rawRating);
  const rating = Number.isInteger(parsedRating) ? parsedRating : NaN;

  if (!bookingId) {
    return errorResponse(400, "BOOKING_ID_REQUIRED", "bookingId is required.");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorResponse(400, "INVALID_RATING", "rating must be an integer between 1 and 5.");
  }

  const rawComment = (body as { comment?: unknown }).comment;
  const comment = typeof rawComment === "string" ? rawComment.trim().slice(0, 2000) || null : null;

  const booking = await prisma.prestaBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      customerId: true,
      providerId: true,
    },
  });

  if (!booking) {
    return errorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  if (booking.status !== PrestaBookingStatus.COMPLETED) {
    return errorResponse(409, "BOOKING_NOT_COMPLETED", "Booking must be COMPLETED before leaving a review.");
  }

  const isParticipant =
    session.user.id === booking.customerId || session.user.id === booking.providerId;

  if (!isParticipant) {
    return errorResponse(403, "FORBIDDEN", "Only booking participants can leave a review.");
  }

  const existing = await prisma.review.findUnique({
    where: {
      authorId_bookingId: {
        authorId: session.user.id,
        bookingId: booking.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return errorResponse(409, "ALREADY_REVIEWED", "You already reviewed this booking.");
  }

  const rateLimited = await assertActionRateLimit(request, {
    routeKey: "review-create",
    label: "reviews",
    windowMs: 60 * 60 * 1000,
    ipLimit: 40,
    scopes: [
      { prefix: "user", id: session.user.id, limit: 10 },
      { prefix: "booking-user", id: `${session.user.id}:${booking.id}`, limit: 3 },
    ],
  });
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const targetUserId =
      session.user.id === booking.customerId ? booking.providerId : booking.customerId;

    const review = await prisma.review.create({
      data: {
        authorId: session.user.id,
        targetUserId,
        bookingId: booking.id,
        rating,
        comment,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        bookingId: true,
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse(409, "ALREADY_REVIEWED", "You already reviewed this booking.");
    }

    throw error;
  }
}
