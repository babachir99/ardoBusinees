import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  ImmoMonetizationKind,
  PaymentLedgerContextType,
  PaymentLedgerStatus,
} from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse, normalizeString } from "@/app/api/immo/listings/_shared";
import { AuditReason, auditLog, getCorrelationId, withCorrelationId } from "@/lib/audit";

const PLATFORM_FEE_BPS = 1000;

const PRICING: Record<ImmoMonetizationKind, { durationDays: number; amountCents: number; currency: string }> = {
  FEATURED: { durationDays: 7, amountCents: 1500, currency: "XOF" },
  BOOST: { durationDays: 3, amountCents: 800, currency: "XOF" },
};

function parseKind(value: unknown): ImmoMonetizationKind | null {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized === "FEATURED" || normalized === "BOOST") {
    return normalized as ImmoMonetizationKind;
  }
  return null;
}

function getCheckoutUrl(intentId: string) {
  const base = normalizeString(process.env.PAYDUNYA_CHECKOUT_BASE_URL ?? process.env.PAYDUNYA_CHECKOUT_URL);
  if (!base) return null;
  return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(intentId)}`;
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const respond = (response: NextResponse) => withCorrelationId(response, correlationId);
  const action = "immo.monetizationCheckoutCreate";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    auditLog({
      correlationId,
      actor: { system: true },
      action,
      entity: { type: "ImmoMonetizationPurchase" },
      outcome: "DENIED",
      reason: AuditReason.UNAUTHORIZED,
    });
    return respond(errorResponse(401, "UNAUTHORIZED", "Authentication required."));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoMonetizationPurchase" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_INPUT", "listingId and kind are required."));
  }

  const listingId = normalizeString((body as { listingId?: unknown }).listingId);
  const kind = parseKind((body as { kind?: unknown }).kind);

  if (!listingId || !kind) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoMonetizationPurchase" },
      outcome: "CONFLICT",
      reason: AuditReason.INVALID_INPUT,
    });
    return respond(errorResponse(400, "INVALID_INPUT", "listingId and valid kind are required."));
  }

  const listing = await prisma.immoListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
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

  if (!listing) {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoListing", id: listingId },
      outcome: "CONFLICT",
      reason: AuditReason.NOT_FOUND,
    });
    return respond(errorResponse(404, "LISTING_NOT_FOUND", "Listing not found."));
  }

  if (listing.status !== "PUBLISHED") {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoListing", id: listingId },
      outcome: "CONFLICT",
      reason: AuditReason.STATE_CONFLICT,
      metadata: { status: listing.status },
    });
    return respond(errorResponse(409, "LISTING_NOT_PUBLISHED", "Listing must be published for monetization."));
  }

  if (!listing.publisherId || !listing.publisher || listing.publisher.type !== "AGENCY" || listing.publisher.status !== "ACTIVE") {
    auditLog({
      correlationId,
      actor: { userId: session.user.id, role: session.user.role ?? null },
      action,
      entity: { type: "ImmoListing", id: listingId },
      outcome: "CONFLICT",
      reason: AuditReason.STATE_CONFLICT,
    });
    return respond(errorResponse(409, "PUBLISHER_REQUIRED", "Active agency publisher is required."));
  }

  const isAdmin = canAccessAdmin(session.user);
  if (!isAdmin) {
    const membership = await prisma.immoPublisherMember.findFirst({
      where: {
        publisherId: listing.publisherId,
        userId: session.user.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!membership) {
      auditLog({
        correlationId,
        actor: { userId: session.user.id, role: session.user.role ?? null },
        action,
        entity: { type: "ImmoPublisher", id: listing.publisherId },
        outcome: "DENIED",
        reason: AuditReason.FORBIDDEN,
      });
      return respond(errorResponse(403, "FORBIDDEN", "Only active agency members can purchase monetization."));
    }
  }

  const pricing = PRICING[kind];
  const intentId = randomUUID();
  const platformFeeCents = Math.round((pricing.amountCents * PLATFORM_FEE_BPS) / 10000);
  const payoutCents = pricing.amountCents - platformFeeCents;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const ledger = await tx.paymentLedger.create({
        data: {
          provider: "PAYDUNYA",
          providerIntentId: intentId,
          contextType: PaymentLedgerContextType.IMMO_MONETIZATION,
          contextId: `${listing.id}:${kind}:${intentId}`,
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

      const purchase = await tx.immoMonetizationPurchase.create({
        data: {
          listingId: listing.id,
          publisherId: listing.publisherId!,
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
      entity: { type: "ImmoMonetizationPurchase", id: created.purchase.id },
      outcome: "SUCCESS",
      reason: AuditReason.SUCCESS,
      metadata: {
        listingId,
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
      entity: { type: "ImmoMonetizationPurchase", id: listingId },
      outcome: "ERROR",
      reason: AuditReason.DB_ERROR,
    });
    return respond(errorResponse(503, "PRISMA_ERROR", "Database unavailable."));
  }
}
