import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allStatuses = ["REQUESTED", "ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED", "CANCELED", "REJECTED"] as const;
type TiakStatus = (typeof allStatuses)[number];

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

function normalizeStatus(value: unknown): TiakStatus | null {
  const status = normalizeString(value).toUpperCase();
  if ((allStatuses as readonly string[]).includes(status)) {
    return status as TiakStatus;
  }
  return null;
}

function normalizeProofUrl(value: unknown) {
  const proofUrl = normalizeString(value);
  if (!proofUrl) return null;
  if (
    proofUrl.startsWith("/uploads/") ||
    proofUrl.startsWith("http://") ||
    proofUrl.startsWith("https://")
  ) {
    return proofUrl.slice(0, 500);
  }
  return null;
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

  const status = normalizeStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const note = normalizeString(body.note).slice(0, 600) || null;
  const proofUrl = normalizeProofUrl(body.proofUrl);

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
  const isAssignedCourier = session.user.id === delivery.courierId;

  if (!isAdmin && !isAssignedCourier) {
    return NextResponse.json({ error: "Only assigned courier or admin can add events" }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedDelivery = await tx.tiakDelivery.update({
      where: { id: delivery.id },
      data: {
        status,
      },
      select: {
        id: true,
        status: true,
      },
    });

    const event = await tx.tiakDeliveryEvent.create({
      data: {
        deliveryId: delivery.id,
        status,
        note,
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

    return { updatedDelivery, event };
  });

  return NextResponse.json(
    {
      event: result.event,
      deliveryStatus: result.updatedDelivery.status,
    },
    { status: 201 }
  );
}
