import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseProductIds(raw: string | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 24);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("productIds") ?? searchParams.get("ids");
  const productIds = parseProductIds(idsParam);

  const takeParam = Number(searchParams.get("take") ?? "6");
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 18) : 6;

  if (productIds.length === 0) {
    return NextResponse.json({ similar: [], complementary: [] });
  }

  const sourceProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sellerId: true },
  });

  if (sourceProducts.length === 0) {
    return NextResponse.json({ similar: [], complementary: [] });
  }

  const sourceIds = sourceProducts.map((product) => product.id);
  const sourceSellerIds = new Set(
    sourceProducts.map((product) => product.sellerId).filter(Boolean)
  );

  const sourceCategories = await prisma.productCategory.findMany({
    where: { productId: { in: sourceIds } },
    select: { categoryId: true },
  });
  const sourceCategoryIds = new Set(sourceCategories.map((entry) => entry.categoryId));

  const orFilters: Array<Record<string, unknown>> = [];
  if (sourceSellerIds.size > 0) {
    orFilters.push({ sellerId: { in: Array.from(sourceSellerIds) } });
  }
  if (sourceCategoryIds.size > 0) {
    orFilters.push({
      categories: {
        some: { categoryId: { in: Array.from(sourceCategoryIds) } },
      },
    });
  }

  if (orFilters.length === 0) {
    return NextResponse.json({ similar: [], complementary: [] });
  }

  const candidates = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { notIn: sourceIds },
      OR: orFilters,
      AND: [{ OR: [{ type: { not: "LOCAL" } }, { stockQuantity: { gt: 0 } }] }],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      priceCents: true,
      discountPercent: true,
      currency: true,
      sellerId: true,
      type: true,
      stockQuantity: true,
      createdAt: true,
      seller: { select: { displayName: true, slug: true } },
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      categories: { select: { categoryId: true } },
    },
    take: 72,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ similar: [], complementary: [] });
  }

  const reviewRows = await prisma.productReview.groupBy({
    by: ["productId"],
    where: {
      productId: { in: candidates.map((product) => product.id) },
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const reviewStatsByProduct = new Map(
    reviewRows.map((row) => [
      row.productId,
      {
        ratingAvg: Number(row._avg.rating ?? 0),
        reviewCount: row._count._all,
      },
    ])
  );

  const now = Date.now();
  const analyzed = candidates.map((product) => {
    const sharedCategories = product.categories.reduce((count, entry) => {
      return count + (sourceCategoryIds.has(entry.categoryId) ? 1 : 0);
    }, 0);

    const sameSeller = Boolean(product.sellerId && sourceSellerIds.has(product.sellerId));
    const reviewStats = reviewStatsByProduct.get(product.id);
    const ratingAvg = reviewStats?.ratingAvg ?? 0;
    const reviewCount = reviewStats?.reviewCount ?? 0;
    const inStock = product.type !== "LOCAL" || (product.stockQuantity ?? 0) > 0;

    const ageDays = Math.max(
      0,
      Math.round((now - new Date(product.createdAt).getTime()) / 86400000)
    );
    const freshnessScore = Math.max(0, 1 - ageDays / 45);

    const qualityScore =
      (ratingAvg / 5) * 1.6 +
      (Math.min(reviewCount, 30) / 30) * 0.8 +
      (inStock ? 0.8 : 0);

    const similarScore =
      sharedCategories * 3 + (sameSeller ? 2 : 0) + qualityScore + freshnessScore;

    const complementaryScore =
      (sameSeller ? 4 : 0) +
      qualityScore +
      freshnessScore +
      (sharedCategories === 0 ? 1.5 : 0) -
      sharedCategories * 1.2;

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      priceCents: product.priceCents,
      discountPercent: product.discountPercent,
      currency: product.currency,
      seller: product.seller,
      images: product.images,
      ratingAvg,
      reviewCount,
      _sharedCategories: sharedCategories,
      _similarScore: similarScore,
      _complementaryScore: complementaryScore,
      _createdAt: product.createdAt,
    };
  });

  const sanitizeAnalyzedProduct = <
    T extends {
      _sharedCategories: number;
      _similarScore: number;
      _complementaryScore: number;
      _createdAt: Date;
    },
  >(
    product: T
  ): Omit<
    T,
    "_sharedCategories" | "_similarScore" | "_complementaryScore" | "_createdAt"
  > => {
    const {
      _sharedCategories,
      _similarScore,
      _complementaryScore,
      _createdAt,
      ...rest
    } = product;
    void _sharedCategories;
    void _similarScore;
    void _complementaryScore;
    void _createdAt;
    return rest;
  };

  const similar = analyzed
    .filter((product) => product._sharedCategories > 0)
    .sort((a, b) => {
      if (b._similarScore !== a._similarScore) {
        return b._similarScore - a._similarScore;
      }
      return new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime();
    })
    .slice(0, take)
    .map((product) => sanitizeAnalyzedProduct(product));

  const complementary = analyzed
    .filter((product) => product._sharedCategories === 0)
    .sort((a, b) => {
      if (b._complementaryScore !== a._complementaryScore) {
        return b._complementaryScore - a._complementaryScore;
      }
      return new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime();
    })
    .slice(0, take)
    .map((product) => sanitizeAnalyzedProduct(product));

  return NextResponse.json({ similar, complementary });
}
