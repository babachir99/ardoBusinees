import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeProofUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!text.startsWith("/uploads/")) return null;
  return text.slice(0, 500);
}

function normalizeProofType(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 100);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const proofUrl = normalizeProofUrl((body as { proofUrl?: unknown }).proofUrl);
  if (!proofUrl) {
    return errorResponse(400, "INVALID_PROOF_URL", "proofUrl must use internal uploads path.");
  }

  const proofType = normalizeProofType((body as { proofType?: unknown }).proofType);

  const runtimePrisma = prisma as unknown as {
    gpShipmentEvent?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        shipment: { transporterId: string };
      } | null>;
      update: (args: unknown) => Promise<{
        id: string;
        status: string;
        proofUrl: string | null;
        proofType: string | null;
        createdAt: Date;
        note: string | null;
      }>;
    };
  };

  if (!runtimePrisma.gpShipmentEvent) {
    return errorResponse(503, "PRISMA_ERROR", "Migration missing: run prisma migrate");
  }

  const { eventId } = await params;

  try {
    const existing = await runtimePrisma.gpShipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        shipment: {
          select: {
            transporterId: true,
          },
        },
      },
    });

    if (!existing) {
      return errorResponse(404, "EVENT_NOT_FOUND", "Shipment event not found.");
    }

    const isAdmin = session.user.role === "ADMIN";
    const isAssignedTransporter = existing.shipment.transporterId === session.user.id;

    if (!isAdmin && !isAssignedTransporter) {
      return errorResponse(403, "FORBIDDEN", "Only assigned transporter or admin can attach proof.");
    }

    const event = await runtimePrisma.gpShipmentEvent.update({
      where: { id: existing.id },
      data: {
        proofUrl,
        proofType,
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

    return NextResponse.json({ event });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}
