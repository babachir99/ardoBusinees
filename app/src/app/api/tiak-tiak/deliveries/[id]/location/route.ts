import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCATION_ACTION = "TIAK_LOCATION_PING";
const shareableStatuses = new Set(["ACCEPTED", "PICKED_UP", "DELIVERED"]);

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeCoordinate(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return Number(parsed.toFixed(6));
}

function normalizeNullableNumber(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > max) return null;
  return Number(parsed.toFixed(2));
}

function toLocationPayload(log: {
  id: string;
  createdAt: Date;
  metadata: Prisma.JsonValue;
  userId: string;
}) {
  const metadata =
    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
      ? (log.metadata as Record<string, unknown>)
      : null;

  const latitude = normalizeCoordinate(metadata?.latitude, -90, 90);
  const longitude = normalizeCoordinate(metadata?.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;

  return {
    id: log.id,
    actorId: log.userId,
    latitude,
    longitude,
    accuracy: normalizeNullableNumber(metadata?.accuracy, 10_000),
    heading: normalizeNullableNumber(metadata?.heading, 360),
    speed: normalizeNullableNumber(metadata?.speed, 1_000),
    createdAt: log.createdAt.toISOString(),
  };
}

async function loadDelivery(deliveryId: string) {
  return prisma.tiakDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      customerId: true,
      courierId: true,
      status: true,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;
  const delivery = await loadDelivery(id);
  if (!delivery) {
    return errorResponse(404, "DELIVERY_NOT_FOUND", "Delivery not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isParticipant =
    session.user.id === delivery.customerId || session.user.id === delivery.courierId;

  if (!isAdmin && !isParticipant) {
    return errorResponse(403, "FORBIDDEN", "Only delivery participants can read location.");
  }

  const latest = await prisma.activityLog.findFirst({
    where: {
      action: LOCATION_ACTION,
      entityType: "TiakDelivery",
      entityId: delivery.id,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json(latest ? toLocationPayload(latest) : null);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;
  const delivery = await loadDelivery(id);
  if (!delivery) {
    return errorResponse(404, "DELIVERY_NOT_FOUND", "Delivery not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isAssignedCourier = session.user.id === delivery.courierId;

  if (!isAdmin && !isAssignedCourier) {
    return errorResponse(403, "FORBIDDEN", "Only assigned courier can publish location.");
  }

  if (!shareableStatuses.has(delivery.status)) {
    return errorResponse(409, "INVALID_STATUS", "Location sharing is available only during active delivery steps.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const latitude = normalizeCoordinate((body as { latitude?: unknown }).latitude, -90, 90);
  const longitude = normalizeCoordinate((body as { longitude?: unknown }).longitude, -180, 180);
  if (latitude === null || longitude === null) {
    return errorResponse(400, "INVALID_COORDINATES", "latitude and longitude are required.");
  }

  const accuracy = normalizeNullableNumber((body as { accuracy?: unknown }).accuracy, 10_000);
  const heading = normalizeNullableNumber((body as { heading?: unknown }).heading, 360);
  const speed = normalizeNullableNumber((body as { speed?: unknown }).speed, 1_000);

  const log = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: LOCATION_ACTION,
      entityType: "TiakDelivery",
      entityId: delivery.id,
      metadata: {
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
      } as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      userId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json(toLocationPayload(log), { status: 201 });
}
