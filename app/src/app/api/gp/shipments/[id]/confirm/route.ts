import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { normalizeDeliveryStep } from "@/lib/notifications/delivery-step";

const RECEIPT_CONFIRMED_NOTE = "Receipt confirmed";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await params;

  const runtimePrisma = prisma as unknown as {
    gpShipment?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        bookingId: string | null;
        code: string;
        status: string;
        senderId: string | null;
        receiverId: string | null;
        transporterId: string;
      } | null>;
      updateMany: (args: unknown) => Promise<{ count: number }>;
    };
    gpShipmentEvent?: {
      findFirst: (args: unknown) => Promise<{
        id: string;
        status: string;
        createdAt: Date;
        note: string | null;
        proofUrl: string | null;
        proofType: string | null;
      } | null>;
      create: (args: unknown) => Promise<{
        id: string;
        status: string;
        createdAt: Date;
        note: string | null;
        proofUrl: string | null;
        proofType: string | null;
      }>;
    };
    gpTripBooking?: {
      update: (args: unknown) => Promise<unknown>;
    };
    $transaction: <T>(callback: (tx: unknown) => Promise<T>) => Promise<T>;
  };

  if (!runtimePrisma.gpShipment || !runtimePrisma.gpShipmentEvent) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const shipment = await runtimePrisma.gpShipment.findUnique({
    where: { id },
    select: {
      id: true,
      bookingId: true,
      code: true,
      status: true,
      senderId: true,
      receiverId: true,
      transporterId: true,
    },
  });

  if (!shipment) {
    return errorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found.");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isReceiptParticipant =
    shipment.senderId === session.user.id || shipment.receiverId === session.user.id;

  if (!isAdmin && !isReceiptParticipant) {
    return errorResponse(403, "FORBIDDEN", "Only shipment sender/receiver can confirm receipt.");
  }

  if (!["ARRIVED", "DELIVERED"].includes(shipment.status)) {
    return errorResponse(409, "INVALID_STATUS", "Shipment must be ARRIVED or DELIVERED before confirmation.");
  }

  const existingConfirmation = await runtimePrisma.gpShipmentEvent.findFirst({
    where: {
      shipmentId: shipment.id,
      note: RECEIPT_CONFIRMED_NOTE,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      note: true,
      proofUrl: true,
      proofType: true,
    },
  });

  if (existingConfirmation) {
    return NextResponse.json({
      shipment: {
        id: shipment.id,
        code: shipment.code,
        status: "DELIVERED",
      },
      event: existingConfirmation,
      alreadyConfirmed: true,
    });
  }

  const result = await runtimePrisma.$transaction(async (tx) => {
    const txRuntime = tx as {
      gpShipment: {
        updateMany: (args: unknown) => Promise<{ count: number }>;
      };
      gpShipmentEvent: {
        create: (args: unknown) => Promise<{
          id: string;
          status: string;
          createdAt: Date;
          note: string | null;
          proofUrl: string | null;
          proofType: string | null;
        }>;
      };
      gpTripBooking?: {
        update: (args: unknown) => Promise<unknown>;
      };
    };

    if (shipment.status !== "DELIVERED") {
      await txRuntime.gpShipment.updateMany({
        where: {
          id: shipment.id,
          status: shipment.status,
        },
        data: {
          status: "DELIVERED",
        },
      });
    }

    if (shipment.bookingId && txRuntime.gpTripBooking) {
      await txRuntime.gpTripBooking.update({
        where: { id: shipment.bookingId },
        data: {
          status: "DELIVERED",
          confirmedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    const event = await txRuntime.gpShipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: "DELIVERED",
        note: RECEIPT_CONFIRMED_NOTE,
        actorId: session.user.id,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        note: true,
        proofUrl: true,
        proofType: true,
      },
    });

    return {
      shipment: {
        id: shipment.id,
        code: shipment.code,
        status: "DELIVERED",
      },
      event,
    };
  });

  const normalizedStep = normalizeDeliveryStep("GP", "DELIVERED");
  const recipientIds = Array.from(
    new Set([shipment.senderId, shipment.receiverId, shipment.transporterId].filter((value): value is string => Boolean(value)))
  ).filter((recipientId) => recipientId !== session.user.id);

  for (const recipientId of recipientIds) {
    await NotificationService.queueEmail({
      userId: recipientId,
      kind: "TRANSACTIONAL",
      templateKey: "delivery_update",
      payload: {
        orderId: shipment.code,
        trackingStep: normalizedStep,
        eta: "",
        link: `/gp/shipments/${shipment.id}`,
      },
      dedupeKey: `delivery_update:gp:${shipment.id}:receipt_confirmed:${recipientId}`,
    }).catch(() => null);
  }

  return NextResponse.json({
    ...result,
    alreadyConfirmed: false,
  });
}
