import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrestaBookingStatus, PaymentMethod } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";
import { isEitherBlocked } from "@/lib/trust-blocks";

const vertical = Vertical.PRESTA;
const rules = getVerticalRules(vertical);
const unlockStatusHint = rules.contact.unlockStatusHint;

function hasPrestaDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaService?: unknown;
    prestaBooking?: unknown;
  };

  return Boolean(runtimePrisma.prestaService && runtimePrisma.prestaBooking);
}
const contactUnlockStatuses: PrestaBookingStatus[] = [
  PrestaBookingStatus.CONFIRMED,
  PrestaBookingStatus.PAID,
  PrestaBookingStatus.COMPLETED,
];

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function parsePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) return null;
  const allowed = new Set<PaymentMethod>(Object.values(PaymentMethod));
  const methods = value
    .map((entry) => normalizeString(entry).toUpperCase())
    .filter((entry): entry is PaymentMethod => allowed.has(entry as PaymentMethod));

  const unique = Array.from(new Set(methods));
  return unique.length > 0 ? unique : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasPrestaDelegates()) {
    return NextResponse.json(
      { error: "PRESTA delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const session = await getServerSession(authOptions);

  const service = await prisma.prestaService.findUnique({
    where: { id },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  if (!service || !service.isActive) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  let unlockedByStatus = false;
  if (session?.user?.id && session.user.id !== service.providerId && session.user.role !== "ADMIN") {
    const unlockedBooking = await prisma.prestaBooking.findFirst({
      where: {
        serviceId: service.id,
        customerId: session.user.id,
        status: { in: contactUnlockStatuses },
      },
      select: { id: true },
    });

    unlockedByStatus = Boolean(unlockedBooking);
  }

  const interactionBlocked = Boolean(
    session?.user?.id &&
      session.user.id !== service.providerId &&
      (await isEitherBlocked(session.user.id, service.providerId))
  );

  const policy = evaluateContactPolicy({
    viewerId: session?.user?.id ?? null,
    viewerRole: session?.user?.role ?? null,
    ownerId: service.providerId,
    unlockedByStatus,
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint,
  });

  return NextResponse.json({
    id: service.id,
    providerId: service.providerId,
    storeId: service.storeId,
    title: service.title,
    description: service.description,
    category: service.category,
    city: service.city,
    basePriceCents: service.basePriceCents,
    currency: service.currency,
    acceptedPaymentMethods: service.acceptedPaymentMethods,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    provider: {
      id: service.provider.id,
      name: service.provider.name,
      image: service.provider.image,
    },
    store: service.store,
    contactLocked: interactionBlocked ? true : policy.contactLocked,
    contactUnlockStatusHint: interactionBlocked ? "BLOCKED_USER" : policy.contactUnlockStatusHint,
    ...(policy.canRevealContact && !interactionBlocked
      ? { contactPhone: service.contactPhone ?? service.provider.phone ?? null }
      : {}),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.prestaService.findUnique({
    where: { id },
    select: { id: true, providerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = session.user.id === existing.providerId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = normalizeString(body.title);
    if (!title) return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    data.title = title;
  }

  if (body.description !== undefined) data.description = normalizeString(body.description) || null;
  if (body.category !== undefined) data.category = normalizeString(body.category) || null;
  if (body.city !== undefined) data.city = normalizeString(body.city) || null;
  if (body.currency !== undefined) data.currency = normalizeString(body.currency).toUpperCase() || "XOF";

  if (body.basePriceCents !== undefined || body.price !== undefined) {
    const amount = parsePositiveInt(body.basePriceCents ?? body.price);
    if (!amount) return NextResponse.json({ error: "Invalid basePriceCents" }, { status: 400 });
    data.basePriceCents = amount;
  }

  if (body.acceptedPaymentMethods !== undefined) {
    const methods = parsePaymentMethods(body.acceptedPaymentMethods);
    if (!methods) {
      return NextResponse.json({ error: "Invalid acceptedPaymentMethods" }, { status: 400 });
    }
    data.acceptedPaymentMethods = methods;
  }

  if (body.contactPhone !== undefined) {
    data.contactPhone = normalizeString(body.contactPhone) || null;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.prestaService.update({
    where: { id: existing.id },
    data,
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
        },
      },
      store: {
        select: { id: true, slug: true, name: true },
      },
    },
  });

  const policy = evaluateContactPolicy({
    viewerId: session.user.id,
    viewerRole: session.user.role,
    ownerId: updated.providerId,
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint,
  });

  return NextResponse.json({
    id: updated.id,
    providerId: updated.providerId,
    storeId: updated.storeId,
    title: updated.title,
    description: updated.description,
    category: updated.category,
    city: updated.city,
    basePriceCents: updated.basePriceCents,
    currency: updated.currency,
    acceptedPaymentMethods: updated.acceptedPaymentMethods,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    provider: {
      id: updated.provider.id,
      name: updated.provider.name,
      image: updated.provider.image,
    },
    store: updated.store,
    contactLocked: policy.contactLocked,
    contactUnlockStatusHint: policy.contactUnlockStatusHint,
    ...(policy.canRevealContact
      ? { contactPhone: updated.contactPhone ?? updated.provider.phone ?? null }
      : {}),
  });
}

