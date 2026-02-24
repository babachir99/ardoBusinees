import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  CarMonetizationKind,
  PaymentLedgerContextType,
  PaymentLedgerStatus,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse, normalizeString } from "@/app/api/cars/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";
import { checkRateLimit, getRateLimitHeaders, resolveClientIp } from "@/lib/rate-limit";

const PLATFORM_FEE_BPS = 1000;

const PRICING: Record<CarMonetizationKind, { durationDays: number; amountCents: number; currency: string }> = {
  FEATURED: { durationDays: 7, amountCents: 1500, currency: "XOF" },
  BOOST: { durationDays: 3, amountCents: 800, currency: "XOF" },
  BOOST_PACK_10: { durationDays: 0, amountCents: 2500, currency: "XOF" },
  FEATURED_PACK_4: { durationDays: 0, amountCents: 4500, currency: "XOF" },
  EXTRA_SLOTS_10: { durationDays: 0, amountCents: 3000, currency: "XOF" },
};

function parseKind(value: unknown): CarMonetizationKind | null {
  const normalized = normalizeString(value).toUpperCase();
  if (
    normalized === "FEATURED" ||
    normalized === "BOOST" ||
    normalized === "BOOST_PACK_10" ||
    normalized === "FEATURED_PACK_4" ||
    normalized === "EXTRA_SLOTS_10"
  ) {
    return normalized as CarMonetizationKind;
  }
  return null;
}

function getCheckoutUrl(intentId: string) {
  const base = normalizeString(process.env.PAYDUNYA_CHECKOUT_BASE_URL ?? process.env.PAYDUNYA_CHECKOUT_URL);
  if (!base) return null;
  return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(intentId)}`;
}

function isListingKind(kind: CarMonetizationKind) {
  return kind === "FEATURED" || kind === "BOOST";
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "cars.monetizationCheckoutCreate";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "CarMonetizationPurchase" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }


  const clientIp = resolveClientIp(request);
  const userRate = checkRateLimit({
    key: `cars:monetization:checkout:user:${session.user.id}`,
    limit: 10,
    windowMs: 60_000,
  });

  if (!userRate.allowed) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase" },
      outcome: "CONFLICT",
      reason: AuditReason.STATE_CONFLICT,
      metadata: { scope: "USER", ip: clientIp },
    });

    return respond(
      NextResponse.json(
        { error: "RATE_LIMITED", message: "Too many checkout attempts. Please retry in a minute." },
        { status: 429, headers: getRateLimitHeaders(userRate) }
      )
    );
  }

  const globalRate = checkRateLimit({
    key: "cars:monetization:checkout:global",
    limit: 30,
    windowMs: 60_000,
  });

  if (!globalRate.allowed) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase" },
      outcome: "CONFLICT",
      reason: AuditReason.STATE_CONFLICT,
      metadata: { scope: "GLOBAL", ip: clientIp },
    });

    return respond(
      NextResponse.json(
        { error: "RATE_LIMITED", message: "Checkout temporarily throttled. Please retry shortly." },
        { status: 429, headers: getRateLimitHeaders(globalRate) }
      )
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_INPUT", "kind is required."));
  }

  const listingId = normalizeString((body as { listingId?: unknown }).listingId);
  const publisherIdInput = normalizeString((body as { publisherId?: unknown }).publisherId);
  const kind = parseKind((body as { kind?: unknown }).kind);

  if (!kind) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_INPUT", "valid kind is required."));
  }

  const hasListingId = Boolean(listingId);
  const hasPublisherId = Boolean(publisherIdInput);

  if (isListingKind(kind) && hasPublisherId) {
    return respond(errorResponse(400, "INVALID_INPUT", "publisherId is not allowed for FEATURED or BOOST."));
  }

  if (!isListingKind(kind) && hasListingId) {
    return respond(errorResponse(400, "INVALID_INPUT", "listingId is not allowed for pack purchases."));
  }

  const pricing = PRICING[kind];
  const isAdmin = canAccessAdmin(session.user);

  let resolvedListing: {
    id: string;
    status: string;
    currency: string;
    publisherId: string;
    publisher: { id: string; type: string; status: string };
  } | null = null;
  let resolvedPublisherId = "";

  if (isListingKind(kind)) {
    if (!listingId) {
      return respond(errorResponse(400, "INVALID_INPUT", "listingId is required for FEATURED or BOOST."));
    }

    const listing = await prisma.carListing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        status: true,
        currency: true,
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

    if (listing.status !== "PUBLISHED") {
      return respond(errorResponse(409, "LISTING_NOT_PUBLISHED", "Listing must be published for monetization."));
    }

    if (listing.publisher.type !== "DEALER" || listing.publisher.status !== "ACTIVE") {
      return respond(errorResponse(409, "PUBLISHER_REQUIRED", "Active dealer publisher is required."));
    }

    if (listing.currency !== pricing.currency) {
      return respond(
        errorResponse(
          409,
          "UNSUPPORTED_CURRENCY",
          `Listing currency ${listing.currency} is not supported for monetization pricing ${pricing.currency}.`
        )
      );
    }

    if (!isAdmin) {
      const membership = await prisma.carPublisherMember.findFirst({
        where: {
          publisherId,
          userId: session.user.id,
          status: "ACTIVE",
          role: { in: ["OWNER", "AGENT"] },
        },
        select: { id: true },
      });

      if (!membership) {
        return respond(errorResponse(403, "FORBIDDEN", "Only active dealer members can purchase monetization."));
      }
    }

    resolvedListing = {
      id: listing.id,
      status: listing.status,
      currency: listing.currency,
      publisherId,
      publisher: {
        id: listing.publisher.id,
        type: listing.publisher.type,
        status: listing.publisher.status,
      },
    };
    resolvedPublisherId = publisherId;

    try {
      const creditApplied = await prisma.$transaction(async (tx) => {
        const consumed =
          kind === "FEATURED"
            ? await tx.carMonetizationBalance.updateMany({
                where: {
                  publisherId,
                  featuredCredits: { gt: 0 },
                },
                data: {
                  featuredCredits: { decrement: 1 },
                },
              })
            : await tx.carMonetizationBalance.updateMany({
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

        const latest = await tx.carListing.findUnique({
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

        if (kind === "FEATURED") {
          const base = latest.featuredUntil && latest.featuredUntil > now ? latest.featuredUntil : now;
          const featuredUntil = new Date(base.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000);
          await tx.carListing.update({
            where: { id: listing.id },
            data: {
              isFeatured: true,
              featuredUntil,
              monetizationUpdatedAt: now,
            },
          });
        } else {
          const base = latest.boostUntil && latest.boostUntil > now ? latest.boostUntil : now;
          const boostUntil = new Date(base.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000);
          await tx.carListing.update({
            where: { id: listing.id },
            data: {
              boostUntil,
              monetizationUpdatedAt: now,
            },
          });
        }

        const balance = await tx.carMonetizationBalance.findUnique({
          where: { publisherId },
          select: {
            boostCredits: true,
            featuredCredits: true,
          },
        });

        const updatedListing = await tx.carListing.findUnique({
          where: { id: listing.id },
          select: {
            id: true,
            featuredUntil: true,
            boostUntil: true,
          },
        });

        return {
          listingId: listing.id,
          featuredUntil: updatedListing?.featuredUntil ?? null,
          boostUntil: updatedListing?.boostUntil ?? null,
          remainingBoostCredits: balance?.boostCredits ?? 0,
          remainingFeaturedCredits: balance?.featuredCredits ?? 0,
        };
      });

      if (creditApplied) {
        auditLog({
          correlationId,
          actor: { userId: session.user.id, role: session.user.role ?? null },
          action,
          entity: { type: "CarListing", id: listing.id },
          outcome: "SUCCESS",
          reason: AuditReason.SUCCESS,
          metadata: {
            kind,
            appliedWithCredits: true,
            publisherId,
            remainingBoostCredits: creditApplied.remainingBoostCredits,
            remainingFeaturedCredits: creditApplied.remainingFeaturedCredits,
          },
        });

        return respond(
          NextResponse.json(
            {
              appliedWithCredits: true,
              listing: {
                id: creditApplied.listingId,
                featuredUntil: creditApplied.featuredUntil,
                boostUntil: creditApplied.boostUntil,
              },
              balance: {
                boostCredits: creditApplied.remainingBoostCredits,
                featuredCredits: creditApplied.remainingFeaturedCredits,
              },
            },
            { status: 200 }
          )
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message === "LISTING_NOT_PUBLISHED") {
        return respond(errorResponse(409, "LISTING_NOT_PUBLISHED", "Listing must remain published for monetization."));
      }

      auditLog({
        correlationId,
        actor: { userId: session.user.id, role: session.user.role ?? null },
        action,
        entity: { type: "CarListing", id: listing.id },
        outcome: "ERROR",
        reason: AuditReason.DB_ERROR,
      });

      return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
    }
  } else {
    if (!publisherIdInput) {
      return respond(errorResponse(400, "INVALID_INPUT", "publisherId is required for pack purchases."));
    }

    const publisher = await prisma.carPublisher.findUnique({
      where: { id: publisherIdInput },
      select: {
        id: true,
        type: true,
        status: true,
      },
    });

    if (!publisher || publisher.type !== "DEALER" || publisher.status !== "ACTIVE") {
      return respond(errorResponse(404, "PUBLISHER_NOT_FOUND", "Active dealer publisher not found."));
    }

    if (!isAdmin) {
      const membership = await prisma.carPublisherMember.findFirst({
        where: {
          publisherId: publisher.id,
          userId: session.user.id,
          status: "ACTIVE",
          role: { in: ["OWNER", "AGENT"] },
        },
        select: { id: true },
      });

      if (!membership) {
        return respond(errorResponse(403, "FORBIDDEN", "Only active dealer members can purchase packs."));
      }
    }

    resolvedPublisherId = publisher.id;
  }


  const dedupWindowStart = new Date(Date.now() - 60_000);
  const existingPendingPurchase = await prisma.carMonetizationPurchase.findFirst({
    where: {
      createdByUserId: session.user.id,
      kind,
      status: "PENDING",
      publisherId: resolvedPublisherId,
      listingId: isListingKind(kind) ? (resolvedListing?.id ?? null) : null,
      createdAt: { gte: dedupWindowStart },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      listingId: true,
      publisherId: true,
      kind: true,
      durationDays: true,
      amountCents: true,
      currency: true,
      status: true,
      paymentLedgerId: true,
      createdAt: true,
      paymentLedger: {
        select: {
          id: true,
          providerIntentId: true,
          status: true,
        },
      },
    },
  });

  if (existingPendingPurchase?.paymentLedger?.providerIntentId) {
    const existingIntentId = existingPendingPurchase.paymentLedger.providerIntentId;
    const existingCheckoutUrl = getCheckoutUrl(existingIntentId);

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase", id: existingPendingPurchase.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        deduped: true,
        kind,
        listingId: resolvedListing?.id ?? null,
        publisherId: resolvedPublisherId,
        paymentLedgerId: existingPendingPurchase.paymentLedgerId,
      },
    });

    return respond(
      NextResponse.json(
        {
          deduped: true,
          purchase: {
            id: existingPendingPurchase.id,
            listingId: existingPendingPurchase.listingId,
            publisherId: existingPendingPurchase.publisherId,
            kind: existingPendingPurchase.kind,
            durationDays: existingPendingPurchase.durationDays,
            amountCents: existingPendingPurchase.amountCents,
            currency: existingPendingPurchase.currency,
            status: existingPendingPurchase.status,
            paymentLedgerId: existingPendingPurchase.paymentLedgerId,
            createdAt: existingPendingPurchase.createdAt,
          },
          payment: {
            intentId: existingIntentId,
            ledgerId: existingPendingPurchase.paymentLedger.id,
            status: existingPendingPurchase.paymentLedger.status,
            checkoutUrl: existingCheckoutUrl,
            callbackUrl: "/api/payments/paydunya/callback",
          },
          checkoutUrl: existingCheckoutUrl,
        },
        { status: 200 }
      )
    );
  }

  const intentId = randomUUID();
  const platformFeeCents = Math.round((pricing.amountCents * PLATFORM_FEE_BPS) / 10000);
  const payoutCents = pricing.amountCents - platformFeeCents;
  const contextRef = isListingKind(kind) ? (resolvedListing?.id ?? resolvedPublisherId) : resolvedPublisherId;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const ledger = await tx.paymentLedger.create({
        data: {
          provider: "PAYDUNYA",
          providerIntentId: intentId,
          contextType: PaymentLedgerContextType.CARS_MONETIZATION,
          contextId: `${contextRef}:${kind}:${intentId}`,
          amountTotalCents: pricing.amountCents,
          platformFeeCents,
          payoutCents,
          currency: pricing.currency,
          status: PaymentLedgerStatus.INITIATED,
        },
        select: {
          id: true,
          providerIntentId: true,
          status: true,
        },
      });

      const purchase = await tx.carMonetizationPurchase.create({
        data: {
          listingId: resolvedListing?.id ?? null,
          publisherId: resolvedPublisherId,
          kind,
          durationDays: pricing.durationDays,
          amountCents: pricing.amountCents,
          currency: pricing.currency,
          status: "PENDING",
          paymentLedgerId: ledger.id,
          createdByUserId: session.user.id,
        },
        select: {
          id: true,
          listingId: true,
          publisherId: true,
          kind: true,
          durationDays: true,
          amountCents: true,
          currency: true,
          status: true,
          paymentLedgerId: true,
          createdAt: true,
        },
      });

      return { ledger, purchase };
    });

    const checkoutUrl = getCheckoutUrl(intentId);

    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase", id: created.purchase.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        listingId: resolvedListing?.id ?? null,
        publisherId: resolvedPublisherId,
        kind,
        amountCents: pricing.amountCents,
        currency: pricing.currency,
        paymentLedgerId: created.purchase.paymentLedgerId,
      },
    });

    return respond(
      NextResponse.json(
        {
          purchase: created.purchase,
          payment: {
            intentId,
            ledgerId: created.ledger.id,
            status: created.ledger.status,
            checkoutUrl,
            callbackUrl: "/api/payments/paydunya/callback",
          },
          checkoutUrl,
        },
        { status: 201 }
      )
    );
  } catch {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "CarMonetizationPurchase", id: resolvedListing?.id ?? resolvedPublisherId },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
