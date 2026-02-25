import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManagePublisher,
  errorResponse,
  normalizeString,
  parseBoolean,
  slugifyImmoPublisher,
} from "@/app/api/immo/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/request-security";

function parseTake(value: unknown, fallback = 24, max = 60) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function parseSkip(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

async function createUniqueSlug(baseInput: string) {
  const base = slugifyImmoPublisher(baseInput);
  let candidate = base;

  for (let i = 0; i < 24; i += 1) {
    const exists = await prisma.immoPublisher.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;
    candidate = `${base}-${i + 2}`;
  }

  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const { searchParams } = new URL(request.url);

  const country = normalizeString(searchParams.get("country")).toUpperCase();
  const city = normalizeString(searchParams.get("city"));
  const verifiedOnly = parseBoolean(searchParams.get("verified"));
  const take = parseTake(searchParams.get("take"), 24, 60);
  const skip = parseSkip(searchParams.get("skip"));

  const where: Prisma.ImmoPublisherWhereInput = {
    type: "AGENCY",
    status: "ACTIVE",
  };

  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (verifiedOnly === true) where.verified = true;

  const publishers = await prisma.immoPublisher.findMany({
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
    },
  });

  return respond(NextResponse.json({ publishers }));
}

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor: { userId: null, role: null },
      action: "immo.publisherCreate",
      entity: { type: "immo_publisher" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }

  if (!canManagePublisher(session.user)) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "immo.publisherCreate",
      entity: { type: "immo_publisher" },
      outcome: "DENIED",
      reason: AuditReason.FORBIDDEN,
    });
    return respond(errorResponse(403, "FORBIDDEN", "Creating agencies requires IMMO_AGENT or ADMIN role."));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return respond(errorResponse(400, "INVALID_BODY", "Invalid JSON body."));
  }

  const name = normalizeString((body as { name?: unknown }).name);
  const country = normalizeString((body as { country?: unknown }).country).toUpperCase() || null;
  const city = normalizeString((body as { city?: unknown }).city) || null;
  const logoUrl = normalizeString((body as { logoUrl?: unknown }).logoUrl) || null;

  if (!name) {
    return respond(errorResponse(400, "VALIDATION_ERROR", "name is required."));
  }

  const slug = await createUniqueSlug(name);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const publisher = await tx.immoPublisher.create({
        data: {
          type: "AGENCY",
          name,
          slug,
          status: "ACTIVE",
          verified: false,
          country,
          city,
          logoUrl,
        },
        select: {
          id: true,
          type: true,
          name: true,
          slug: true,
          status: true,
          verified: true,
          country: true,
          city: true,
          logoUrl: true,
          createdAt: true,
        },
      });

      await tx.immoPublisherMember.create({
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
      action: "immo.publisherCreate",
      entity: { type: "immo_publisher", id: created.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: { slug: created.slug },
    });

    return respond(NextResponse.json({ publisher: created }, { status: 201 }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return respond(errorResponse(409, "PUBLISHER_EXISTS", "Publisher slug already exists."));
    }

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action: "immo.publisherCreate",
      entity: { type: "immo_publisher" },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });

    return respond(errorResponse(503, "DB_ERROR", "Database unavailable."));
  }
}
