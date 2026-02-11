import type { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDiscountedPrice } from "@/lib/format";

export type PersistedCartItem = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  type: ProductType;
  quantity: number;
  sellerName?: string;
  offerId?: string;
  optionColor?: string;
  optionSize?: string;
  maxQuantity?: number;
  lineId: string;
};

type UpsertCartItemInput = {
  productId: string;
  quantity?: number;
  optionColor?: string;
  optionSize?: string;
  offerId?: string;
};

export class CartError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeQuantity(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function buildLineId(input: {
  productId: string;
  offerId?: string;
  optionColor?: string;
  optionSize?: string;
}) {
  return [
    input.productId,
    input.offerId ?? "",
    input.optionColor ?? "",
    input.optionSize ?? "",
  ].join("::");
}

async function getOrCreateUserCart(userId: string) {
  return prisma.userCart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
}

function resolveMaxQuantity(type: ProductType, stockQuantity: number | null) {
  if (type !== "LOCAL") return undefined;
  const stock = Number(stockQuantity ?? 0);
  if (!Number.isFinite(stock) || stock <= 0) return 0;
  return Math.floor(stock);
}

async function ensureProductForCart(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      discountPercent: true,
      currency: true,
      type: true,
      isActive: true,
      stockQuantity: true,
      colorOptions: true,
      sizeOptions: true,
      seller: { select: { displayName: true } },
    },
  });

  if (!product || !product.isActive) {
    throw new CartError("Product unavailable", 404);
  }

  return product;
}

async function ensureAcceptedOffer(params: {
  offerId?: string;
  productId: string;
  userId: string;
  quantity: number;
}) {
  if (!params.offerId) return null;

  const offer = await prisma.productOffer.findUnique({
    where: { id: params.offerId },
    select: {
      id: true,
      productId: true,
      buyerId: true,
      status: true,
      quantity: true,
      amountCents: true,
    },
  });

  if (!offer) {
    throw new CartError("Offer not found", 404);
  }
  if (offer.buyerId !== params.userId) {
    throw new CartError("Offer is not linked to your account", 403);
  }
  if (offer.productId !== params.productId) {
    throw new CartError("Offer and product mismatch", 400);
  }
  if (offer.status !== "ACCEPTED") {
    throw new CartError("Offer is not accepted", 400);
  }
  if (params.quantity > offer.quantity) {
    throw new CartError("Requested quantity exceeds accepted offer", 400);
  }

  return offer;
}

async function sanitizeCartItemInput(userId: string, input: UpsertCartItemInput) {
  const productId = String(input.productId ?? "").trim();
  if (!productId) {
    throw new CartError("productId is required", 400);
  }

  const quantity = normalizeQuantity(input.quantity, 1);
  const product = await ensureProductForCart(productId);

  const optionColor = normalizeOptionalString(input.optionColor, 64);
  const optionSize = normalizeOptionalString(input.optionSize, 32);

  if (optionColor && product.colorOptions.length > 0) {
    const known = new Set(product.colorOptions.map((value) => value.trim().toLowerCase()));
    if (!known.has(optionColor.toLowerCase())) {
      throw new CartError("Unknown color option", 400);
    }
  }

  if (optionSize && product.sizeOptions.length > 0) {
    const known = new Set(product.sizeOptions.map((value) => value.trim().toLowerCase()));
    if (!known.has(optionSize.toLowerCase())) {
      throw new CartError("Unknown size option", 400);
    }
  }

  const maxQuantity = resolveMaxQuantity(product.type, product.stockQuantity);
  if (maxQuantity !== undefined && maxQuantity <= 0) {
    throw new CartError("Product out of stock", 409);
  }

  const offerId = normalizeOptionalString(input.offerId, 64);
  const offer = await ensureAcceptedOffer({
    offerId,
    productId,
    userId,
    quantity,
  });

  return {
    product,
    quantity,
    optionColor,
    optionSize,
    offer,
    offerId: offer?.id,
    maxQuantity,
    lineId: buildLineId({ productId, offerId: offer?.id, optionColor, optionSize }),
  };
}

export async function getCartItemsForUser(userId: string): Promise<PersistedCartItem[]> {
  const cart = await prisma.userCart.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: [{ updatedAt: "desc" }],
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              priceCents: true,
              discountPercent: true,
              currency: true,
              type: true,
              isActive: true,
              stockQuantity: true,
              seller: { select: { displayName: true } },
            },
          },
          offer: {
            select: {
              id: true,
              productId: true,
              buyerId: true,
              status: true,
              quantity: true,
              amountCents: true,
            },
          },
        },
      },
    },
  });

  if (!cart) return [];

  const toDelete: string[] = [];
  const toUpdate: Array<{ id: string; quantity: number }> = [];
  const normalized: PersistedCartItem[] = [];

  for (const entry of cart.items) {
    const product = entry.product;
    if (!product?.isActive) {
      toDelete.push(entry.id);
      continue;
    }

    const maxQuantity = resolveMaxQuantity(product.type, product.stockQuantity);
    if (maxQuantity !== undefined && maxQuantity <= 0) {
      toDelete.push(entry.id);
      continue;
    }

    let quantity = normalizeQuantity(entry.quantity, 1);
    if (maxQuantity !== undefined) {
      quantity = Math.min(quantity, maxQuantity);
    }

    if (quantity !== entry.quantity) {
      toUpdate.push({ id: entry.id, quantity });
    }

    const hasValidOffer =
      Boolean(entry.offer) &&
      entry.offer?.status === "ACCEPTED" &&
      entry.offer?.buyerId === userId &&
      entry.offer?.productId === product.id;

    const priceCents = hasValidOffer
      ? Number(entry.offer?.amountCents ?? product.priceCents)
      : getDiscountedPrice(product.priceCents, product.discountPercent);

    normalized.push({
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceCents,
      currency: product.currency,
      type: product.type,
      quantity,
      sellerName: product.seller?.displayName,
      offerId: hasValidOffer ? entry.offer?.id : undefined,
      optionColor: entry.optionColor ?? undefined,
      optionSize: entry.optionSize ?? undefined,
      maxQuantity: maxQuantity === undefined ? undefined : maxQuantity,
      lineId: entry.lineId,
    });
  }

  if (toDelete.length > 0 || toUpdate.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.userCartItem.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const update of toUpdate) {
        await tx.userCartItem.update({
          where: { id: update.id },
          data: { quantity: update.quantity },
        });
      }
    });
  }

  return normalized;
}

export async function addCartItemForUser(userId: string, input: UpsertCartItemInput) {
  const cart = await getOrCreateUserCart(userId);
  const sanitized = await sanitizeCartItemInput(userId, input);

  const existing = await prisma.userCartItem.findUnique({
    where: {
      cartId_lineId: {
        cartId: cart.id,
        lineId: sanitized.lineId,
      },
    },
    select: { id: true, quantity: true },
  });

  let nextQuantity = existing ? existing.quantity + sanitized.quantity : sanitized.quantity;

  if (sanitized.maxQuantity !== undefined) {
    nextQuantity = Math.min(nextQuantity, sanitized.maxQuantity);
  }

  if (sanitized.offer) {
    nextQuantity = Math.min(nextQuantity, sanitized.offer.quantity);
  }

  await prisma.userCartItem.upsert({
    where: {
      cartId_lineId: {
        cartId: cart.id,
        lineId: sanitized.lineId,
      },
    },
    update: {
      quantity: Math.max(1, nextQuantity),
      offerId: sanitized.offerId,
      optionColor: sanitized.optionColor,
      optionSize: sanitized.optionSize,
    },
    create: {
      cartId: cart.id,
      lineId: sanitized.lineId,
      productId: sanitized.product.id,
      offerId: sanitized.offerId,
      quantity: Math.max(1, nextQuantity),
      optionColor: sanitized.optionColor,
      optionSize: sanitized.optionSize,
    },
  });

  return getCartItemsForUser(userId);
}

export async function updateCartItemQuantityForUser(
  userId: string,
  lineId: string,
  quantityInput: number
) {
  const quantity = normalizeQuantity(quantityInput, 0);
  const cart = await prisma.userCart.findUnique({ where: { userId }, select: { id: true } });

  if (!cart) return [];

  const item = await prisma.userCartItem.findUnique({
    where: { cartId_lineId: { cartId: cart.id, lineId } },
    include: {
      product: {
        select: {
          id: true,
          type: true,
          stockQuantity: true,
          isActive: true,
        },
      },
      offer: {
        select: {
          id: true,
          status: true,
          buyerId: true,
          productId: true,
          quantity: true,
        },
      },
    },
  });

  if (!item) return getCartItemsForUser(userId);

  if (quantity <= 0 || !item.product?.isActive) {
    await prisma.userCartItem.delete({ where: { id: item.id } });
    return getCartItemsForUser(userId);
  }

  const maxQuantity = resolveMaxQuantity(item.product.type, item.product.stockQuantity);
  if (maxQuantity !== undefined && maxQuantity <= 0) {
    await prisma.userCartItem.delete({ where: { id: item.id } });
    return getCartItemsForUser(userId);
  }

  let safeQuantity = quantity;
  if (maxQuantity !== undefined) {
    safeQuantity = Math.min(safeQuantity, maxQuantity);
  }

  const hasValidOffer =
    Boolean(item.offer) &&
    item.offer?.status === "ACCEPTED" &&
    item.offer?.buyerId === userId &&
    item.offer?.productId === item.product.id;

  if (hasValidOffer) {
    safeQuantity = Math.min(safeQuantity, Number(item.offer?.quantity ?? safeQuantity));
  }

  await prisma.userCartItem.update({
    where: { id: item.id },
    data: { quantity: Math.max(1, safeQuantity) },
  });

  return getCartItemsForUser(userId);
}

export async function removeCartItemForUser(userId: string, lineId: string) {
  const cart = await prisma.userCart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return [];

  await prisma.userCartItem.deleteMany({
    where: { cartId: cart.id, lineId },
  });

  return getCartItemsForUser(userId);
}

export async function clearCartForUser(userId: string) {
  const cart = await prisma.userCart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return [];

  await prisma.userCartItem.deleteMany({ where: { cartId: cart.id } });
  return [];
}

export async function mergeCartForUser(
  userId: string,
  items: UpsertCartItemInput[]
): Promise<PersistedCartItem[]> {
  const uniqueItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 120) : [];

  for (const entry of uniqueItems) {
    try {
      await addCartItemForUser(userId, {
        productId: String(entry.productId ?? ""),
        quantity: normalizeQuantity(entry.quantity, 1),
        optionColor: entry.optionColor,
        optionSize: entry.optionSize,
        offerId: entry.offerId,
      });
    } catch (error) {
      if (error instanceof CartError) {
        continue;
      }
      throw error;
    }
  }

  return getCartItemsForUser(userId);
}
