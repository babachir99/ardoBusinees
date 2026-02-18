import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { KycRole, KycStatus, PaymentMethod } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";

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
  if (!Array.isArray(value)) return [PaymentMethod.CASH];
  const allowed = new Set<PaymentMethod>(Object.values(PaymentMethod));
  const methods = value
    .map((entry) => normalizeString(entry).toUpperCase())
    .filter((entry): entry is PaymentMethod => allowed.has(entry as PaymentMethod));

  const unique = Array.from(new Set(methods));
  return unique.length > 0 ? unique : [PaymentMethod.CASH];
}

export async function GET(request: NextRequest) {
  if (!hasPrestaDelegates()) {
    return NextResponse.json(
      { error: "PRESTA delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = normalizeString(searchParams.get("q"));
  const city = normalizeString(searchParams.get("city"));
  const category = normalizeString(searchParams.get("category"));
  const takeRaw = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 100) : 20;

  const where: Record<string, unknown> = { isActive: true };

  if (city) {
    where.city = { contains: city, mode: "insensitive" };
  }

  if (category) {
    where.category = { equals: category, mode: "insensitive" };
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const services = await prisma.prestaService.findMany({
    where,
    take,
    orderBy: [{ createdAt: "desc" }],
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

  const payload = services.map((service) => {
    const policy = evaluateContactPolicy({
      lockedByDefault: rules.contact.lockedByDefault,
      unlockStatusHint,
    });

    return {
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
      contactLocked: policy.contactLocked,
      contactUnlockStatusHint: policy.contactUnlockStatusHint,
    };
  });

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  if (!hasPrestaDelegates()) {
    return NextResponse.json(
      { error: "PRESTA delegates unavailable. Run npx prisma generate and restart dev server." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles = new Set(rules.publishRoles);
  if (!allowedRoles.has(session.user.role as typeof rules.publishRoles[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (rules.kycRequiredForPublishing && session.user.role !== "ADMIN") {
    const approvedKyc = await prisma.kycSubmission.findFirst({
      where: {
        userId: session.user.id,
        targetRole: KycRole.SELLER,
        status: KycStatus.APPROVED,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (!approvedKyc) {
      return NextResponse.json(
        { error: "KYC approval is required to publish on PRESTA." },
        { status: 403 }
      );
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = normalizeString(body.title);
  const description = normalizeString(body.description) || null;
  const category = normalizeString(body.category) || null;
  const city = normalizeString(body.city) || null;
  const basePriceCents = parsePositiveInt(body.basePriceCents ?? body.price);
  const currency = normalizeString(body.currency).toUpperCase() || "XOF";
  const acceptedPaymentMethods = parsePaymentMethods(body.acceptedPaymentMethods);

  if (!title || !basePriceCents) {
    return NextResponse.json(
      { error: "title and basePriceCents are required" },
      { status: 400 }
    );
  }

  const prestaStore = await prisma.store.findUnique({
    where: { slug: "jontaado-presta" },
    select: { id: true, isActive: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });

  const service = await prisma.prestaService.create({
    data: {
      providerId: session.user.id,
      storeId: prestaStore?.isActive ? prestaStore.id : null,
      title,
      description,
      category,
      city,
      basePriceCents,
      currency,
      acceptedPaymentMethods,
      contactPhone: normalizeString(body.contactPhone) || user?.phone || null,
      isActive: true,
    },
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
    ownerId: service.providerId,
    lockedByDefault: rules.contact.lockedByDefault,
    unlockStatusHint,
  });

  return NextResponse.json(
    {
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
      contactLocked: policy.contactLocked,
      contactUnlockStatusHint: policy.contactUnlockStatusHint,
      ...(policy.canRevealContact
        ? { contactPhone: service.contactPhone ?? service.provider.phone ?? null }
        : {}),
    },
    { status: 201 }
  );
}
