import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdmin,
  canManageAutoPublisher,
  errorResponse,
  normalizeSkip,
  normalizeString,
  normalizeTake,
  normalizeUpper,
  parseBoolean,
  slugifyAutoPublisher,
} from "@/app/api/auto/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/request-security";

async function ensureUniqueSlug(base: string) {
  const existing = await prisma.autoPublisher.findMany({
    where: {
      slug: {
        startsWith: base,
      },
    },
    select: { slug: true },
  });

  if (!existing.some((item) => item.slug === base)) {
    return base;
  }

  let index = 2;
  while (existing.some((item) => item.slug === `${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const country = normalizeUpper(searchParams.get("country"));
  const city = normalizeString(searchParams.get("city"));
  const verifiedOnly = parseBoolean(searchParams.get("verified"));
  const take = normalizeTake(searchParams.get("take"), 24, 60);
  const skip = normalizeSkip(searchParams.get("skip"));

  const where: Record<string, unknown> = {
    type: "DEALER",
    status: "ACTIVE",
  };

  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (verifiedOnly === true) where.verified = true;

  const publishers = await prisma.autoPublisher.findMany({
    where,
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
    take,
    skip,
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      country: true,
      city: true,
      logoUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ publishers });
}

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const correlationId = getCorrelationId(request);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return withCorrelationId(errorResponse(401, "UNAUTHORIZED", "Authentication required."), correlationId);
  }

  if (!canManageAutoPublisher(session.user)) {
    return withCorrelationId(
      errorResponse(403, "FORBIDDEN", "Dealer management requires SELLER or ADMIN role."),
      correlationId
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return withCorrelationId(errorResponse(400, "INVALID_BODY", "Invalid JSON body."), correlationId);
  }

  const name = normalizeString((body as { name?: unknown }).name);
  const country = normalizeUpper((body as { country?: unknown }).country) || null;
  const city = normalizeString((body as { city?: unknown }).city) || null;
  const logoUrl = normalizeString((body as { logoUrl?: unknown }).logoUrl) || null;

  if (!name) {
    return withCorrelationId(errorResponse(400, "VALIDATION_ERROR", "name is required."), correlationId);
  }

  const baseSlug = slugifyAutoPublisher(name);
  const slug = await ensureUniqueSlug(baseSlug);

  const created = await prisma.$transaction(async (tx) => {
    const publisher = await tx.autoPublisher.create({
      data: {
        type: "DEALER",
        name,
        slug,
        country,
        city,
        logoUrl,
        status: "ACTIVE",
        verified: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        verified: true,
        country: true,
        city: true,
        logoUrl: true,
        status: true,
        type: true,
        createdAt: true,
      },
    });

    await tx.autoPublisherMember.create({
      data: {
        publisherId: publisher.id,
        userId: session.user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return publisher;
  });

  auditLog({
    correlationId,
    actor: { userId: session.user.id, role: session.user.role ?? null },
    action: "auto.publisherCreate",
    entity: { type: "auto_publisher", id: created.id },
    outcome: "SUCCESS",
    reason: AuditReason.SUCCESS,
    metadata: {
      slug: created.slug,
      isAdmin: canAccessAdmin(session.user),
    },
  });

  return withCorrelationId(NextResponse.json({ publisher: created }, { status: 201 }), correlationId);
}
