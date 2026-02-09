import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { Prisma, ProductType } from "@prisma/client";

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);

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
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;

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
    return NextResponse.json(
      { error: "slug is invalid" },
      { status: 400 }
    );
  }

  const slug = await ensureUniqueProductSlug(sellerId, baseSlug);

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter(Boolean)
    : [];

  const data: Prisma.ProductCreateInput = {
    seller: { connect: { id: sellerId } },
    ...(body.storeId ? { store: { connect: { id: String(body.storeId) } } } : {}),
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
  };

  if (discountPercent !== undefined) {
    data.discountPercent = discountPercent;
  }

  if (requestBoost) {
    data.boostStatus = "PENDING";
    data.boostRequestedAt = new Date();
  }

  const product = await prisma.product.create({
    data,
  });

  return NextResponse.json(product, { status: 201 });
}
