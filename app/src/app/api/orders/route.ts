import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDiscountedPrice } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { PaymentMethod, ProductType } from "@prisma/client";
import { releaseExpiredPendingLocalOrders } from "@/lib/order-stock";
import {
  checkRateLimitAsync,
  getRateLimitHeaders,
  resolveClientIp,
} from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/request-security";

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);
const allowedPaymentMethods = new Set([
  "WAVE",
  "ORANGE_MONEY",
  "CARD",
  "CASH",
]);
const CHECKOUT_PLATFORM_FEE_RATE = 0.04;
const ORDER_CREATE_WINDOW_MS = 10 * 60 * 1000;

type CheckoutItemInput = {
  productId?: string;
  quantity?: number;
  type?: ProductType;
  optionColor?: string;
  optionSize?: string;
  offerId?: string;
};

type MappedItem = {
  sellerId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  type: ProductType;
  optionColor?: string;
  optionSize?: string;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 120) : "";
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") return "XOF";
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "XOF";
}

function buildGuestCheckoutEmail() {
  return `guest+${randomUUID()}@checkout.local`;
}

function computeCheckoutFeesCents(subtotalCents: number) {
  return Math.max(Math.round(subtotalCents * CHECKOUT_PLATFORM_FEE_RATE), 0);
}

async function enforceOrderCreateRateLimit(request: NextRequest, email: string) {
  const ip = resolveClientIp(request);
  const [ipRate, emailRate] = await Promise.all([
    checkRateLimitAsync({
      key: `orders:create:ip:${ip}`,
      limit: 12,
      windowMs: ORDER_CREATE_WINDOW_MS,
    }),
    email
      ? checkRateLimitAsync({
          key: `orders:create:email:${email}`,
          limit: 4,
          windowMs: ORDER_CREATE_WINDOW_MS,
        })
      : Promise.resolve(null),
  ]);

  const blocked = !ipRate.allowed ? ipRate : emailRate && !emailRate.allowed ? emailRate : null;
  if (!blocked) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many checkout attempts. Please wait a few minutes." },
    { status: 429, headers: getRateLimitHeaders(blocked) }
  );
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;
  const status = searchParams.get("status") ?? undefined;
  const rangeParam = searchParams.get("range");

  const isAdmin = session?.user?.role === "ADMIN";
  const isSeller = session?.user?.role === "SELLER";
  const userId = isAdmin ? searchParams.get("userId") ?? undefined : undefined;
  const email = isAdmin ? normalizeEmail(searchParams.get("email")) || undefined : undefined;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (email) where.buyerEmail = email;
  if (userId) where.userId = userId;
  if (rangeParam) {
    const rangeDays = Number(rangeParam);
    if (Number.isFinite(rangeDays) && rangeDays > 0) {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      where.createdAt = { gte: from };
    }
  }

  let sellerScopeId: string | undefined;

  if (isSeller && session?.user?.id) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    sellerScopeId = sellerProfile?.id;
  }

  const orders = await prisma.order.findMany({
    take,
    orderBy: { createdAt: "desc" },
    where: isAdmin
      ? Object.keys(where).length > 0
        ? where
        : undefined
      : isSeller
      ? sellerScopeId
        ? { sellerId: sellerScopeId, ...(Object.keys(where).length > 0 ? where : {}) }
        : { sellerId: "__missing__" }
      : {
          userId: session.user.id,
          ...(Object.keys(where).length > 0 ? where : {}),
        },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              images: { select: { url: true }, take: 1 },
            },
          },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      messages: session
        ? {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              body: true,
              senderRole: true,
              sender: { select: { name: true, email: true } },
              createdAt: true,
            },
          }
        : undefined,
      user: { select: { id: true, email: true, name: true } },
      seller: { select: { id: true, displayName: true, slug: true } },
    },
  });

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const sameOriginError = assertSameOrigin(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id ?? null;
  const sessionEmail = normalizeEmail(session?.user?.email);
  const guestEmail = normalizeEmail(body.email);
  const buyerEmail = sessionUserId ? sessionEmail || guestEmail || undefined : guestEmail || undefined;
  const buyerName = normalizeOptionalText(body.name, 120);
  const buyerPhone = normalizeOptionalText(body.phone, 40);
  const shippingAddress = normalizeOptionalText(body.shippingAddress, 240);
  const shippingCity = normalizeOptionalText(body.shippingCity, 120);

  let userId = body.userId ? String(body.userId).trim() : "";
  const requestedSellerId = body.sellerId ? String(body.sellerId) : undefined;
  const currency = normalizeCurrency(body.currency);

  if (sessionUserId) {
    if (userId && userId !== sessionUserId) {
      return NextResponse.json(
        { error: "You cannot create an order for another user." },
        { status: 403 }
      );
    }

    userId = sessionUserId;
  } else if (userId) {
    return NextResponse.json(
      { error: "userId is only allowed for authenticated users." },
      { status: 403 }
    );
  }
  const paymentMethod = body.paymentMethod
    ? String(body.paymentMethod).toUpperCase()
    : undefined;
  const items = Array.isArray(body.items) ? (body.items as CheckoutItemInput[]) : [];

  if (!userId && !buyerEmail) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  const rateLimited = await enforceOrderCreateRateLimit(request, buyerEmail ?? sessionEmail);
  if (rateLimited) {
    return rateLimited;
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "items are required" },
      { status: 400 }
    );
  }

  const productIds = items
    .map((item) => String(item.productId ?? ""))
    .filter(Boolean);

  if (productIds.length === 0) {
    return NextResponse.json(
      { error: "Each item needs productId" },
      { status: 400 }
    );
  }

  await releaseExpiredPendingLocalOrders({ productIds });

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sellerId: true,
      priceCents: true,
      discountPercent: true,
      type: true,
      stockQuantity: true,
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const uniqueSellerIds = Array.from(
    new Set(products.map((product) => product.sellerId).filter(Boolean))
  );

  if (uniqueSellerIds.length === 0) {
    return NextResponse.json(
      { error: "Unable to resolve seller for selected products." },
      { status: 400 }
    );
  }

  if (requestedSellerId) {
    if (uniqueSellerIds.length > 1) {
      return NextResponse.json(
        { error: "sellerId cannot be used with multi-seller checkout." },
        { status: 400 }
      );
    }

    if (requestedSellerId !== uniqueSellerIds[0]) {
      return NextResponse.json(
        { error: "sellerId does not match selected products." },
        { status: 400 }
      );
    }
  }

  const offerIds = items
    .map((item) => String(item.offerId ?? "").trim())
    .filter(Boolean);

  const offers = offerIds.length
    ? await prisma.productOffer.findMany({
        where: { id: { in: offerIds } },
        select: {
          id: true,
          productId: true,
          buyerId: true,
          quantity: true,
          amountCents: true,
          status: true,
        },
      })
    : [];

  const offerMap = new Map(offers.map((offer) => [offer.id, offer]));

  let subtotalCents = 0;
  const mappedItems: MappedItem[] = [];

  for (const item of items) {
    const quantity = Number(item.quantity ?? 1);
    const productId = String(item.productId ?? "");
    const product = productMap.get(productId);

    if (!product) {
      return NextResponse.json(
        { error: `Product ${productId} not found` },
        { status: 400 }
      );
    }

    const type = product.type;

    if (!allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "Each item needs a valid type" },
        { status: 400 }
      );
    }

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Each item needs productId and a valid quantity" },
        { status: 400 }
      );
    }

    const offerId = item.offerId ? String(item.offerId).trim() : undefined;
    const matchedOffer = offerId ? offerMap.get(offerId) : undefined;

    if (offerId) {
      if (!sessionUserId) {
        return NextResponse.json(
          { error: "Sign in to pay an accepted offer." },
          { status: 401 }
        );
      }

      if (!matchedOffer) {
        return NextResponse.json({ error: "Offer not found." }, { status: 400 });
      }

      if (matchedOffer.buyerId !== sessionUserId) {
        return NextResponse.json(
          { error: "This offer does not belong to your account." },
          { status: 403 }
        );
      }

      if (matchedOffer.productId !== productId) {
        return NextResponse.json({ error: "Offer/product mismatch." }, { status: 400 });
      }

      if (matchedOffer.status !== "ACCEPTED") {
        return NextResponse.json(
          { error: "Offer is not accepted yet." },
          { status: 400 }
        );
      }

      if (quantity > matchedOffer.quantity) {
        return NextResponse.json(
          { error: "Requested quantity exceeds accepted offer quantity." },
          { status: 400 }
        );
      }
    }

    const unitPriceCents = matchedOffer
      ? matchedOffer.amountCents
      : getDiscountedPrice(product.priceCents, product.discountPercent);

    subtotalCents += quantity * unitPriceCents;

    const optionColor = item.optionColor
      ? String(item.optionColor).trim().slice(0, 64)
      : undefined;
    const optionSize = item.optionSize
      ? String(item.optionSize).trim().slice(0, 32)
      : undefined;

    mappedItems.push({
      sellerId: product.sellerId,
      productId,
      quantity,
      unitPriceCents,
      type,
      optionColor,
      optionSize,
    });
  }

  if (paymentMethod === "CASH" && mappedItems.some((item) => item.type !== "LOCAL")) {
    return NextResponse.json(
      { error: "Cash is only available for local products." },
      { status: 400 }
    );
  }

  if (paymentMethod && !allowedPaymentMethods.has(paymentMethod)) {
    return NextResponse.json(
      { error: "paymentMethod must be WAVE, ORANGE_MONEY, CARD, or CASH" },
      { status: 400 }
    );
  }

  const typedPaymentMethod = paymentMethod as PaymentMethod | undefined;
  const shippingCents = 0;
  const feesCents = computeCheckoutFeesCents(subtotalCents);

  const localRequestedByProduct = new Map<string, number>();
  for (const item of mappedItems) {
    if (item.type !== "LOCAL") continue;
    localRequestedByProduct.set(
      item.productId,
      (localRequestedByProduct.get(item.productId) ?? 0) + item.quantity
    );
  }

  for (const [productId, quantity] of localRequestedByProduct.entries()) {
    const product = productMap.get(productId);
    const available = product?.stockQuantity ?? 0;
    if (available < quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for product ${productId}` },
        { status: 409 }
      );
    }
  }

  try {
    const orders = await prisma.$transaction(async (tx) => {
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const guestUser = await tx.user.create({
          data: {
            email: buildGuestCheckoutEmail(),
            name: buyerName,
            phone: buyerPhone,
            role: "CUSTOMER",
          },
        });

        await tx.userRoleAssignment.create({
          data: {
            userId: guestUser.id,
            role: "CLIENT",
            status: "ACTIVE",
          },
        });

        resolvedUserId = guestUser.id;
        userId = guestUser.id;
      }

      const groupedBySeller = new Map<string, { sellerId: string; subtotalCents: number; items: MappedItem[] }>();

      for (const item of mappedItems) {
        const lineSubtotal = item.quantity * item.unitPriceCents;
        const group = groupedBySeller.get(item.sellerId);

        if (!group) {
          groupedBySeller.set(item.sellerId, {
            sellerId: item.sellerId,
            subtotalCents: lineSubtotal,
            items: [item],
          });
        } else {
          group.subtotalCents += lineSubtotal;
          group.items.push(item);
        }
      }

      const orderGroups = Array.from(groupedBySeller.values());

      for (const [productId, quantity] of localRequestedByProduct.entries()) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            isActive: true,
            stockQuantity: { gte: quantity },
          },
          data: {
            stockQuantity: { decrement: quantity },
          },
        });

        if (updateResult.count !== 1) {
          throw new Error(`OUT_OF_STOCK:${productId}`);
        }
      }

      let allocatedFees = 0;
      let allocatedShipping = 0;

      const createdOrders: Array<{
        id: string;
        sellerId: string | null;
        subtotalCents: number;
        shippingCents: number;
        feesCents: number;
        totalCents: number;
        currency: string;
      }> = [];

      for (let index = 0; index < orderGroups.length; index += 1) {
        const group = orderGroups[index];
        const isLast = index === orderGroups.length - 1;

        const groupFees = isLast
          ? feesCents - allocatedFees
          : Math.floor((feesCents * group.subtotalCents) / Math.max(subtotalCents, 1));

        const groupShipping = isLast
          ? shippingCents - allocatedShipping
          : Math.floor((shippingCents * group.subtotalCents) / Math.max(subtotalCents, 1));

        allocatedFees += groupFees;
        allocatedShipping += groupShipping;

        const groupTotal = group.subtotalCents + groupShipping + groupFees;

        const createdOrder = await tx.order.create({
          data: {
            userId: resolvedUserId,
            sellerId: group.sellerId,
            buyerName,
            buyerEmail,
            buyerPhone,
            shippingAddress,
            shippingCity,
            paymentMethod: typedPaymentMethod ?? undefined,
            subtotalCents: group.subtotalCents,
            shippingCents: groupShipping,
            feesCents: groupFees,
            totalCents: groupTotal,
            currency,
            items: {
              create: group.items.map((orderItem) => ({
                productId: orderItem.productId,
                unitPriceCents: orderItem.unitPriceCents,
                quantity: orderItem.quantity,
                type: orderItem.type,
                optionColor: orderItem.optionColor,
                optionSize: orderItem.optionSize,
              })),
            },
            events: {
              create: [
                {
                  status: "PENDING",
                  note: "Order placed",
                },
              ],
            },
          },
        });

        createdOrders.push({
          id: createdOrder.id,
          sellerId: createdOrder.sellerId,
          subtotalCents: createdOrder.subtotalCents,
          shippingCents: createdOrder.shippingCents,
          feesCents: createdOrder.feesCents,
          totalCents: createdOrder.totalCents,
          currency: createdOrder.currency,
        });
      }

      await tx.activityLog.createMany({
        data: createdOrders.map((order) => ({
          userId: resolvedUserId,
          action: "ORDER_CREATED",
          entityType: "Order",
          entityId: order.id,
          metadata: { sellerId: order.sellerId, totalCents: order.totalCents },
        })),
      });

      return createdOrders;
    });

    if (sessionUserId) {
      await prisma.userCartItem.deleteMany({
        where: {
          cart: { userId: sessionUserId },
        },
      });
    }

    const primaryOrder = orders[0];

    return NextResponse.json(
      {
        id: primaryOrder.id,
        orderIds: orders.map((order) => order.id),
        orders,
        multiSeller: orders.length > 1,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OUT_OF_STOCK:")) {
      return NextResponse.json(
        { error: "One or more products are out of stock." },
        { status: 409 }
      );
    }
    throw error;
  }
}



