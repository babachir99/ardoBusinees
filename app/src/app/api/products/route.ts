import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);

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

  const where: Record<string, unknown> = { isActive: true };
  if (type && allowedTypes.has(type)) {
    where.type = type;
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
  const title = String(body.title ?? "");
  const slug = String(body.slug ?? "");
  const priceCents = Number(body.priceCents);

  if (!sellerId || !title || !slug || !Number.isFinite(priceCents)) {
    return NextResponse.json(
      { error: "sellerId, title, slug, priceCents are required" },
      { status: 400 }
    );
  }

  const product = await prisma.product.create({
    data: {
      sellerId,
      storeId: body.storeId ?? undefined,
      title,
      slug,
      description: body.description ?? undefined,
      priceCents,
      currency: body.currency ?? "XOF",
      type,
      preorderLeadDays: body.preorderLeadDays ?? undefined,
      dropshipSupplier: body.dropshipSupplier ?? undefined,
      stockQuantity: body.stockQuantity ?? undefined,
      pickupLocation: body.pickupLocation ?? undefined,
      deliveryOptions: body.deliveryOptions ?? undefined,
      isActive: body.isActive ?? true,
      images: Array.isArray(body.imageUrls) && body.imageUrls.length > 0
        ? {
            create: body.imageUrls.map((url: string, index: number) => ({
              url,
              alt: body.imageAlt ?? body.title,
              position: index,
            })),
          }
        : undefined,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
