import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeMessageAttachmentUrl } from "@/lib/message-attachments";

function hasTiakDelegates() {
  const runtimePrisma = prisma as unknown as {
    tiakDelivery?: unknown;
    tiakDeliveryEvent?: unknown;
  };

  return Boolean(runtimePrisma.tiakDelivery && runtimePrisma.tiakDeliveryEvent);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeProofUrl(value: unknown) {
  return normalizeMessageAttachmentUrl(value);
}

function normalizeRating(value: unknown) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  if (numeric < 1 || numeric > 5) return null;
  return numeric;
}

function toRatingNote(rating: number, comment: string | null) {
  const normalizedComment = comment?.trim() || "";
  return normalizedComment ? `RATING:${rating}|${normalizedComment}` : `RATING:${rating}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasTiakDelegates()) {
    return NextResponse.json(
      { error: "TIAK TIAK delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const delivery = await prisma.tiakDelivery.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      courierId: true,
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwnerOrCourier =
    session.user.id === delivery.customerId ||
    session.user.id === delivery.courierId;

  if (!isAdmin && !isOwnerOrCourier) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events = await prisma.tiakDeliveryEvent.findMany({
    where: { deliveryId: delivery.id },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      deliveryId: true,
      status: true,
      note: true,
      proofUrl: true,
      createdAt: true,
      actorId: true,
      actor: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json(events);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasTiakDelegates()) {
    return NextResponse.json(
      { error: "TIAK TIAK delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
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

  const note = normalizeString((body as { note?: unknown }).note).slice(0, 600) || null;
  const proofUrl = normalizeProofUrl((body as { proofUrl?: unknown }).proofUrl);
  const rating = normalizeRating((body as { rating?: unknown }).rating);
  const effectiveNote = rating !== null ? toRatingNote(rating, note).slice(0, 600) : note;

  const delivery = await prisma.tiakDelivery.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      courierId: true,
      status: true,
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isAssignedCourier = session.user.id === delivery.courierId;
  const isCustomer = session.user.id === delivery.customerId;

  if (!isAdmin && !isAssignedCourier && !isCustomer) {
    return NextResponse.json({ error: "Only delivery participants can add events" }, { status: 403 });
  }

  if (!effectiveNote && !proofUrl) {
    return NextResponse.json({ error: "Empty event payload" }, { status: 400 });
  }

  if (rating !== null) {
    if (!isAdmin && !isCustomer) {
      return NextResponse.json({ error: "Only customer or admin can rate delivery" }, { status: 403 });
    }

    if (delivery.status !== "COMPLETED") {
      return NextResponse.json({ error: "Rating available only after COMPLETED" }, { status: 409 });
    }

    const alreadyRated = await prisma.tiakDeliveryEvent.findFirst({
      where: {
        deliveryId: delivery.id,
        actorId: session.user.id,
        note: { startsWith: "RATING:" },
      },
      select: { id: true },
    });

    if (alreadyRated) {
      return NextResponse.json({ error: "Rating already submitted" }, { status: 409 });
    }
  }

  const event = await prisma.tiakDeliveryEvent.create({
    data: {
      deliveryId: delivery.id,
      status: delivery.status,
      note: effectiveNote,
      proofUrl,
      actorId: session.user.id,
    },
    select: {
      id: true,
      deliveryId: true,
      status: true,
      note: true,
      proofUrl: true,
      createdAt: true,
      actorId: true,
      actor: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      event,
      deliveryStatus: delivery.status,
      ignoredInputStatus: normalizeString((body as { status?: unknown }).status).toUpperCase() || null,
    },
    { status: 201 }
  );
}
