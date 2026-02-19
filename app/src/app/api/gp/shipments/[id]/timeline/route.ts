import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const orderedStatuses = ["DROPPED_OFF", "PICKED_UP", "BOARDED", "ARRIVED", "DELIVERED"] as const;

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeNote(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 1000);
}

function isAllowedRole(role: string | undefined) {
  return ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER", "CUSTOMER"].includes(role ?? "");
}

function statusRank(status: string) {
  return orderedStatuses.indexOf(status as (typeof orderedStatuses)[number]);
}

async function loadShipment(id: string) {
  const runtimePrisma = prisma as unknown as {
    gpShipment?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        code: string;
        status: string;
        senderId: string | null;
        receiverId: string | null;
        transporterId: string;
      } | null>;
    };
  };

  if (!runtimePrisma.gpShipment) {
    return { error: errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate"), shipment: null };
  }

  const shipment = await runtimePrisma.gpShipment.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      senderId: true,
      receiverId: true,
      transporterId: true,
    },
  });

  return { error: null, shipment };
}

function canReadTimeline(params: {
  role: string | undefined;
  userId: string;
  shipment: { senderId: string | null; receiverId: string | null; transporterId: string };
}) {
  if (params.role === "ADMIN") return true;
  return (
    params.shipment.senderId === params.userId ||
    params.shipment.receiverId === params.userId ||
    params.shipment.transporterId === params.userId
  );
}

function canWriteTimeline(params: {
  role: string | undefined;
  userId: string;
  shipment: { transporterId: string };
}) {
  if (params.role === "ADMIN") return true;
  return params.shipment.transporterId === params.userId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (!isAllowedRole(session.user.role)) {
    return errorResponse(403, "FORBIDDEN", "Access denied.");
  }

  const { id } = await params;

  try {
    const loaded = await loadShipment(id);
    if (loaded.error) return loaded.error;

    if (!loaded.shipment) {
      return errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found.");
    }

    if (!canReadTimeline({ role: session.user.role, userId: session.user.id, shipment: loaded.shipment })) {
      return errorResponse(403, "FORBIDDEN", "Access denied.");
    }

    const runtimePrisma = prisma as unknown as {
      gpShipmentEvent: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    };

    const events = await runtimePrisma.gpShipmentEvent.findMany({
      where: { shipmentId: loaded.shipment.id },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        note: true,
      },
    });

    return NextResponse.json({
      shipment: {
        id: loaded.shipment.id,
        code: loaded.shipment.code,
        status: loaded.shipment.status,
      },
      events,
    });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
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

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const requestedStatus = String((body as { status?: unknown }).status ?? "").toUpperCase();
  const providedCode = String((body as { code?: unknown }).code ?? "").trim();
  const note = normalizeNote((body as { note?: unknown }).note);

  if (!orderedStatuses.includes(requestedStatus as (typeof orderedStatuses)[number])) {
    return errorResponse(400, "INVALID_STATUS", "Invalid tracking status.");
  }

  try {
    const loaded = await loadShipment(id);
    if (loaded.error) return loaded.error;

    if (!loaded.shipment) {
      return errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found.");
    }

    if (!canWriteTimeline({ role: session.user.role, userId: session.user.id, shipment: loaded.shipment })) {
      return errorResponse(403, "FORBIDDEN", "Only assigned transporter can add events.");
    }

    if (!providedCode || providedCode !== loaded.shipment.code) {
      return errorResponse(400, "INVALID_CODE", "Shipment code mismatch.");
    }

    const currentRank = statusRank(loaded.shipment.status);
    const nextRank = statusRank(requestedStatus);

    if (nextRank === currentRank) {
      return errorResponse(409, "DUPLICATE_EVENT", "This status is already recorded.");
    }

    if (nextRank < currentRank || nextRank > currentRank + 1) {
      return errorResponse(409, "INVALID_TRANSITION", "Status transition not allowed.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const txRuntime = tx as unknown as {
        gpShipment: {
          update: (args: unknown) => Promise<{ id: string; code: string; status: string }>;
        };
        gpShipmentEvent: {
          create: (args: unknown) => Promise<{ id: string; status: string; createdAt: Date; note: string | null }>;
        };
      };

      const shipment = await txRuntime.gpShipment.update({
        where: { id: loaded.shipment!.id },
        data: { status: requestedStatus },
        select: { id: true, code: true, status: true },
      });

      const event = await txRuntime.gpShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: requestedStatus,
          note,
          actorId: session.user.id,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          note: true,
        },
      });

      return { shipment, event };
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
