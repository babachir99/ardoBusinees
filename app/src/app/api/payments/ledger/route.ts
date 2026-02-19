import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PaymentLedgerContextType, PaymentLedgerStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_FEE_BPS = 1000;

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.trunc(amount);
  return rounded > 0 ? rounded : null;
}

function parseContextType(value: unknown): PaymentLedgerContextType | null {
  const normalized = normalizeString(value).toUpperCase();
  if ((Object.values(PaymentLedgerContextType) as string[]).includes(normalized)) {
    return normalized as PaymentLedgerContextType;
  }
  return null;
}

function hasPaymentLedgerDelegate() {
  const runtimePrisma = prisma as unknown as { paymentLedger?: unknown };
  return Boolean(runtimePrisma.paymentLedger);
}

export async function POST(request: NextRequest) {
  if (!hasPaymentLedgerDelegate()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "Payment ledger delegate unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  if (session.user.role !== "ADMIN" && process.env.NODE_ENV === "production") {
    return errorResponse(403, "FORBIDDEN", "Admin role required in production.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_BODY", "JSON body is required.");
  }

  const contextType = parseContextType((body as { contextType?: unknown }).contextType);
  const contextId = normalizeString((body as { contextId?: unknown }).contextId);
  const amountTotalCents = parseAmount((body as { amountTotalCents?: unknown }).amountTotalCents);
  const currency = normalizeString((body as { currency?: unknown }).currency).toUpperCase() || "XOF";
  const providerIntentId = normalizeString((body as { providerIntentId?: unknown }).providerIntentId) || null;

  if (!contextType || !contextId || amountTotalCents === null) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      "contextType, contextId and amountTotalCents are required."
    );
  }

  let orderId: string | null = null;
  if (contextType === PaymentLedgerContextType.SHOP_ORDER) {
    const order = await prisma.order.findUnique({
      where: { id: contextId },
      select: { id: true },
    });
    if (!order) {
      return errorResponse(404, "ORDER_NOT_FOUND", "Order not found for SHOP_ORDER context.");
    }
    orderId = order.id;
  }

  const platformFeeCents = Math.round((amountTotalCents * PLATFORM_FEE_BPS) / 10000);
  const payoutCents = amountTotalCents - platformFeeCents;

  try {
    const ledger = await prisma.paymentLedger.upsert({
      where: {
        contextType_contextId: {
          contextType,
          contextId,
        },
      },
      update: {
        provider: "PAYDUNYA",
        providerIntentId,
        orderId,
        amountTotalCents,
        platformFeeCents,
        payoutCents,
        currency,
        status: PaymentLedgerStatus.INITIATED,
      },
      create: {
        provider: "PAYDUNYA",
        providerIntentId,
        orderId,
        contextType,
        contextId,
        amountTotalCents,
        platformFeeCents,
        payoutCents,
        currency,
        status: PaymentLedgerStatus.INITIATED,
      },
      select: {
        id: true,
        createdAt: true,
        provider: true,
        providerIntentId: true,
        orderId: true,
        contextType: true,
        contextId: true,
        amountTotalCents: true,
        platformFeeCents: true,
        payoutCents: true,
        currency: true,
        status: true,
      },
    });

    return NextResponse.json({ ledger }, { status: 201 });
  } catch {
    return errorResponse(503, "PRISMA_ERROR", "Database unavailable.");
  }
}