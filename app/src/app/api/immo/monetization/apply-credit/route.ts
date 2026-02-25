import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse, normalizeString } from "@/app/api/immo/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/request-security";

const CREDIT_DURATIONS = {
  FEATURED: 7,
  BOOST: 3,
} as const;

type CreditKind = keyof typeof CREDIT_DURATIONS;

function parseKind(value: unknown): CreditKind | null {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized === "FEATURED" || normalized === "BOOST") {
    return normalized as CreditKind;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;

  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "immo.monetizationApplyCredit";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "ImmoMonetizationBalance" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }


  const rate = checkRateLimit({
    key: `immo:monetization:apply-credit:user:${session.user.id}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoMonetizationBalance" },
      outcome: "CONFLICT",
      reason: AuditReason.STATE_CONFLICT,
      metadata: { scope: "USER" },
    });

    return respond(
      NextResponse.json(
        { error: "RATE_LIMITED", message: "Too many credit applications. Please retry shortly." },
        { status: 429, headers: getRateLimitHeaders(rate) }
      )
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return respond(errorResponse(400, "INVALID_INPUT", "listingId and kind are required."));
  }

  const listingId = normalizeString((body as { listingId?: unknown }).listingId);
  const kind = parseKind((body as { kind?: unknown }).kind);

  if (!listingId || !kind) {
    return respond(errorResponse(400, "INVALID_INPUT", "listingId and kind are required."));
  }

  const listing = await prisma.immoListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
      featuredUntil: true,
      boostUntil: true,
      publisherId: true,
      publisher: {
        select: {
          id: true,
          type: true,
          status: true,
        },
      },
    },
  });

  if (!listing || !listing.publisherId || !listing.publisher) {
    return respond(errorResponse(404, "LISTING_NOT_FOUND", "Listing not found."));
  }
  const publisherId = listing.publisherId;

  const now = new Date();
  const boostGuardAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const featuredGuardAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  if (kind === "BOOST" && listing.boostUntil && listing.boostUntil > boostGuardAt) {
    return respond(errorResponse(409, "ALREADY_BOOSTED", "Listing is already boosted long enough."));
  }

  if (kind === "FEATURED" && listing.featuredUntil && listing.featuredUntil > featuredGuardAt) {
    return respond(errorResponse(409, "ALREADY_FEATURED", "Listing is already featured long enough."));
  }

  if (listing.status !== "PUBLISHED") {
    return respond(errorResponse(409, "LISTING_NOT_PUBLISHED", "Listing must be published."));
  }

  if (listing.publisher.type !== "AGENCY" || listing.publisher.status !== "ACTIVE") {
    return respond(errorResponse(409, "PUBLISHER_REQUIRED", "Active agency publisher is required."));
  }

  const isAdmin = canAccessAdmin(session.user);
  if (!isAdmin) {
    const membership = await prisma.immoPublisherMember.findFirst({
      where: {
        publisherId,
        userId: session.user.id,
        status: "ACTIVE",
        role: { in: ["OWNER", "AGENT"] },
      },
      select: { id: true },
    });

    if (!membership) {
      return respond(errorResponse(403, "FORBIDDEN", "Only active agency members can use credits."));
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const consumed =
        kind === "FEATURED"
          ? await tx.immoMonetizationBalance.updateMany({
              where: {
                publisherId,
                featuredCredits: { gt: 0 },
              },
              data: {
                featuredCredits: { decrement: 1 },
              },
            })
          : await tx.immoMonetizationBalance.updateMany({
              where: {
                publisherId,
                boostCredits: { gt: 0 },
              },
              data: {
                boostCredits: { decrement: 1 },
              },
            });

      if (consumed.count === 0) {
        return null;
      }

      const latest = await tx.immoListing.findUnique({
        where: { id: listing.id },
        select: {
          id: true,
          status: true,
          featuredUntil: true,
          boostUntil: true,
        },
      });

      if (!latest || latest.status !== "PUBLISHED") {
        throw new Error("LISTING_NOT_PUBLISHED");
      }

      const now = new Date();
      const durationDays = CREDIT_DURATIONS[kind];
      const txBoostGuardAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const txFeaturedGuardAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      if (kind === "BOOST" && latest.boostUntil && latest.boostUntil > txBoostGuardAt) {
        throw new Error("ALREADY_BOOSTED");
      }

      if (kind === "FEATURED" && latest.featuredUntil && latest.featuredUntil > txFeaturedGuardAt) {
        throw new Error("ALREADY_FEATURED");
      }

      if (kind === "FEATURED") {
        const base = latest.featuredUntil && latest.featuredUntil > now ? latest.featuredUntil : now;
        const featuredUntil = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
        await tx.immoListing.update({
          where: { id: listing.id },
          data: {
            isFeatured: true,
            featuredUntil,
            monetizationUpdatedAt: now,
          },
        });
      } else {
        const base = latest.boostUntil && latest.boostUntil > now ? latest.boostUntil : now;
        const boostUntil = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
        await tx.immoListing.update({
          where: { id: listing.id },
          data: {
            boostUntil,
            monetizationUpdatedAt: now,
          },
        });
      }

      const balance = await tx.immoMonetizationBalance.findUnique({
        where: { publisherId },
        select: {
          boostCredits: true,
          featuredCredits: true,
        },
      });

      const updatedListing = await tx.immoListing.findUnique({
        where: { id: listing.id },
        select: {
          id: true,
          featuredUntil: true,
          boostUntil: true,
        },
      });

      return {
        listing: updatedListing,
        balance,
      };
    });

    if (!result) {
      auditLog({
        correlationId,
        actor: { userId: session.user.id, role: session.user.role ?? null },
        action,
        entity: { type: "ImmoMonetizationBalance", id: publisherId },
        outcome: "CONFLICT",
        reason: AuditReason.STATE_CONFLICT,
        metadata: { kind },
      });
      return respond(errorResponse(409, "NO_CREDITS_AVAILABLE", "No available credits for this kind."));
    }

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoListing", id: listing.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        kind,
        publisherId,
        remainingBoostCredits: result.balance?.boostCredits ?? 0,
        remainingFeaturedCredits: result.balance?.featuredCredits ?? 0,
      },
    });

    return respond(
      NextResponse.json({
        appliedWithCredits: true,
        listing: result.listing,
        balance: {
          boostCredits: result.balance?.boostCredits ?? 0,
          featuredCredits: result.balance?.featuredCredits ?? 0,
        },
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message === "LISTING_NOT_PUBLISHED") {
      return respond(errorResponse(409, "LISTING_NOT_PUBLISHED", "Listing must remain published."));
    }

    if (error instanceof Error && error.message === "ALREADY_BOOSTED") {
      return respond(errorResponse(409, "ALREADY_BOOSTED", "Listing is already boosted long enough."));
    }

    if (error instanceof Error && error.message === "ALREADY_FEATURED") {
      return respond(errorResponse(409, "ALREADY_FEATURED", "Listing is already featured long enough."));
    }

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoListing", id: listing.id },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });

    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
