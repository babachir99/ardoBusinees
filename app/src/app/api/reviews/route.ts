import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrestaBookingStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
