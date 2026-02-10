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

function buildStoreWhere(searchParams: URLSearchParams) {
  const storeId = (searchParams.get("storeId") ?? "").trim();
  const storeSlug = (searchParams.get("store") ?? "").trim();
  const storeTypeRaw = (searchParams.get("storeType") ?? "").trim().toUpperCase();
  const storeType = allowedStoreTypes.has(storeTypeRaw as StoreType)
    ? (storeTypeRaw as StoreType)
    : undefined;

  if (!storeId && !storeSlug && !storeType) {
    return undefined;
  }

  return {
    some: {
      ...(storeId ? { storeId } : {}),
      ...(storeSlug || storeType
        ? {
            store: {
              ...(storeSlug ? { slug: storeSlug } : {}),
              ...(storeType ? { type: storeType } : {}),
            },
          }
        : {}),
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const leafOnlyParam = (searchParams.get("leafOnly") ?? "").trim().toLowerCase();
  const leafOnly = leafOnlyParam === "1" || leafOnlyParam === "true" || leafOnlyParam === "yes";

  const takeParam = Number(searchParams.get("take") ?? "120");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 500)
    : 120;

  const storeWhere = buildStoreWhere(searchParams);

  const where: Prisma.CategoryWhereInput = {
    isActive: true,
    ...(leafOnly ? { parentId: { not: null } } : {}),
    ...(storeWhere ? { stores: storeWhere } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { parent: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const categories = await prisma.category.findMany({
    where,
    include: {
      parent: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    take,
  });

  return NextResponse.json(
    categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
          }
        : null,
      label: category.parent
        ? `${category.parent.name} > ${category.name}`
        : category.name,
    }))
  );
}
