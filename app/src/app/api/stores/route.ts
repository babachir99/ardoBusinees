import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, StoreType } from "@prisma/client";

const allowedStoreTypes = new Set<StoreType>([
  "MARKETPLACE",
  "IMMO",
  "CARS",
  "PRESTA",
  "TIAK_TIAK",
  "GP",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const typeRaw = (searchParams.get("type") ?? "").trim().toUpperCase();
  const type = allowedStoreTypes.has(typeRaw as StoreType)
    ? (typeRaw as StoreType)
    : undefined;

  const takeParam = Number(searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 100)
    : 50;

  const where: Prisma.StoreWhereInput = {
    isActive: true,
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const stores = await prisma.store.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take,
    include: {
      _count: {
        select: {
          products: true,
          categories: true,
        },
      },
    },
  });

  return NextResponse.json(
    stores.map((store) => ({
      id: store.id,
      slug: store.slug,
      name: store.name,
      type: store.type,
      description: store.description,
      productsCount: store._count.products,
      categoriesCount: store._count.categories,
    }))
  );
}
