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

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
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

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function GET(request: NextRequest) {
  if (!hasPrestaDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);

  const { searchParams } = new URL(request.url);
  const q = normalizeString(searchParams.get("q"));
  const city = normalizeString(searchParams.get("city"));
  const category = normalizeString(searchParams.get("category"));
  const take = normalizeTake(searchParams.get("take"), 20, 100);
  const mine = searchParams.get("mine") === "1";

  if (mine && !session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required for mine=1.");
  }

  const where: Record<string, unknown> = mine
    ? { providerId: session!.user.id, isActive: true }
    : { isActive: true };

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
      viewerId: session?.user?.id,
      viewerRole: session?.user?.role,
      ownerId: service.providerId,
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
      ...(policy.canRevealContact
        ? { contactPhone: service.contactPhone ?? service.provider.phone ?? null }
        : {}),
    };
  });

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  if (!hasPrestaDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const allowedRoles = new Set(rules.publishRoles);
  if (!allowedRoles.has(session.user.role as (typeof rules.publishRoles)[number])) {
    return errorResponse(403, "FORBIDDEN", "Role is not allowed to publish PRESTA services.");
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
      return errorResponse(403, "KYC_REQUIRED", "KYC approval is required to publish on PRESTA.");
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const title = normalizeString(body.title);
  const description = normalizeString(body.description) || null;
  const category = normalizeString(body.category) || null;
  const city = normalizeString(body.city) || null;
  const basePriceCents = parsePositiveInt(body.basePriceCents ?? body.price);
  const currency = normalizeString(body.currency).toUpperCase() || "XOF";
  const acceptedPaymentMethods = parsePaymentMethods(body.acceptedPaymentMethods);

  if (!title || !basePriceCents) {
    return errorResponse(400, "VALIDATION_ERROR", "title and basePriceCents are required.");
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

