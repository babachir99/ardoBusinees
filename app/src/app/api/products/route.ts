import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { Prisma, ProductType } from "@prisma/client";

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);

function sanitizeStringList(
  value: unknown,
  maxItems = 20,
  maxLength = 64
): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter((item) => item.length > 0)
        .map((item) => item.slice(0, maxLength))
    )
  ).slice(0, maxItems);
}

function sanitizeAttributes(value: unknown): Prisma.JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => [String(key).trim().slice(0, 64), String(raw ?? "").trim().slice(0, 256)] as const)
    .filter(([key, val]) => key.length > 0 && val.length > 0)
    .slice(0, 24);

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Prisma.JsonObject;
}

async function ensureUniqueProductSlug(sellerId: string, baseSlug: string) {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { sellerId_slug: { sellerId, slug: candidate } },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 50) : 20;

  const typeParam = searchParams.get("type");
  const type = typeParam ? typeParam.toUpperCase() : undefined;
  const sellerId = searchParams.get("sellerId") ?? undefined;
  const categorySlug = searchParams.get("category") ?? undefined;
  const storeSlug = searchParams.get("store") ?? undefined;

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (type && allowedTypes.has(type)) {
    where.type = type as ProductType;
  }
  if (sellerId) {
    where.sellerId = sellerId;
  }
  if (storeSlug) {
    where.store = { slug: storeSlug };
  }
  if (categorySlug) {
    where.categories = { some: { category: { slug: categorySlug } } };
  }

  const products = await prisma.product.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      images: true,
      seller: {
        select: { id: true, displayName: true, slug: true },
      },
    },
  });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = String(body.type ?? "").toUpperCase();
  if (!allowedTypes.has(type)) {
    return NextResponse.json(
      { error: "type must be PREORDER, DROPSHIP, or LOCAL" },
      { status: 400 }
    );
  }

  const sellerId = String(body.sellerId ?? "");
  const title = String(body.title ?? "").trim();
  const rawSlugInput = String(body.slug ?? body.title ?? "");
  const baseSlug = slugify(rawSlugInput);
  const priceCents = Number(body.priceCents);
  const discountRaw = body.discountPercent;
  const requestBoost = Boolean(body.requestBoost);

  let discountPercent: number | null | undefined = undefined;
  if (discountRaw !== undefined) {
    const parsed = Number(discountRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 90) {
      return NextResponse.json(
        { error: "discountPercent must be between 0 and 90" },
        { status: 400 }
      );
    }
    discountPercent = parsed > 0 ? Math.round(parsed) : null;
  }

  if (!sellerId || !title || !Number.isFinite(priceCents)) {
    return NextResponse.json(
      { error: "sellerId, title and priceCents are required" },
      { status: 400 }
    );
  }

  if (!baseSlug) {
    return NextResponse.json({ error: "slug is invalid" }, { status: 400 });
  }

  const slug = await ensureUniqueProductSlug(sellerId, baseSlug);

  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [];

  const colorOptions = sanitizeStringList(body.colorOptions, 20, 40);
  const sizeOptions = sanitizeStringList(body.sizeOptions, 20, 32);
  const attributes = sanitizeAttributes(body.attributes);

  const storeId = body.storeId ? String(body.storeId).trim() : "";

  const categoryIds: string[] = Array.isArray(body.categoryIds)
    ? Array.from(
        new Set(
          (body.categoryIds as unknown[])
            .map((id) => String(id).trim())
            .filter((id): id is string => id.length > 0)
        )
      )
    : [];

  let validCategoryIds: string[] = [];
  if (categoryIds.length > 0) {
    const rows = await prisma.category.findMany({
      where: { id: { in: categoryIds }, isActive: true },
      select: { id: true },
    });
    validCategoryIds = rows.map((row) => row.id);
  }

  if (categoryIds.length > 0 && validCategoryIds.length === 0) {
    return NextResponse.json(
      { error: "Selected categories are invalid or inactive" },
      { status: 400 }
    );
  }

  if (storeId && validCategoryIds.length > 0) {
    const allowed = await prisma.storeCategory.findMany({
      where: {
        storeId,
        categoryId: { in: validCategoryIds },
      },
      select: { categoryId: true },
    });

    const allowedSet = new Set(allowed.map((row) => row.categoryId));
    const incompatible = validCategoryIds.filter((id) => !allowedSet.has(id));
    if (incompatible.length > 0) {
      return NextResponse.json(
        {
          error:
            "Selected categories are not available for the selected store",
        },
        { status: 400 }
      );
    }
  }

  const data: Prisma.ProductCreateInput = {
    seller: { connect: { id: sellerId } },
    ...(storeId ? { store: { connect: { id: storeId } } } : {}),
    title,
    slug,
    description: body.description ?? undefined,
    priceCents,
    currency: body.currency ?? "XOF",
    type: type as ProductType,
    preorderLeadDays: body.preorderLeadDays ?? undefined,
    dropshipSupplier: body.dropshipSupplier ?? undefined,
    stockQuantity: body.stockQuantity ?? undefined,
    pickupLocation: body.pickupLocation ?? undefined,
    deliveryOptions: body.deliveryOptions ?? undefined,
    colorOptions: colorOptions.length > 0 ? colorOptions : undefined,
    sizeOptions: sizeOptions.length > 0 ? sizeOptions : undefined,
    attributes,
    isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    images:
      imageUrls.length > 0
        ? {
            create: imageUrls.map((url: string, index: number) => ({
              url,
              alt: body.imageAlt ?? body.title,
              position: index,
            })),
          }
        : undefined,
    categories:
      validCategoryIds.length > 0
        ? {
            create: validCategoryIds.map((categoryId) => ({
              category: { connect: { id: categoryId } },
            })),
          }
        : undefined,
  };

  if (discountPercent !== undefined) {
    data.discountPercent = discountPercent;
  }

  if (requestBoost) {
    data.boostStatus = "PENDING";
    data.boostRequestedAt = new Date();
  }

  const product = await prisma.product.create({ data });

  return NextResponse.json(product, { status: 201 });
}



