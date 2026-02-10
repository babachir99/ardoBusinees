import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestCategoriesFromTitle } from "@/lib/category-suggester";
import type { Prisma, StoreType } from "@prisma/client";

const allowedStoreTypes = new Set<StoreType>([
  "MARKETPLACE",
  "IMMO",
  "CARS",
  "PRESTA",
  "TIAK_TIAK",
  "GP",
]);

function getTitleFromRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("title") ?? searchParams.get("q") ?? "").trim();
}

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

async function getCategories(
  storeWhere: Prisma.StoreCategoryListRelationFilter | undefined,
  leafOnly: boolean
) {
  return prisma.category.findMany({
    where: {
      isActive: true,
      ...(leafOnly ? { parentId: { not: null } } : {}),
      ...(storeWhere ? { stores: storeWhere } : {}),
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    take: 500,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = getTitleFromRequest(request);
  const leafOnlyParam = (searchParams.get("leafOnly") ?? "1").trim().toLowerCase();
  const leafOnly = leafOnlyParam === "1" || leafOnlyParam === "true" || leafOnlyParam === "yes";

  if (!title) {
    return NextResponse.json(
      {
        categorie_suggeree: null,
        confiance: 0,
        mots_cles_detectes: [],
        categories_alternatives: [],
        explication: "Titre manquant.",
        suggestions: [],
      },
      { status: 400 }
    );
  }

  const storeWhere = buildStoreWhere(searchParams);

  let categories = await getCategories(storeWhere, leafOnly);

  // Keep store mapping priority, but always merge global categories for better coverage.
  if (storeWhere) {
    const fallback = await getCategories(undefined, leafOnly);
    const byId = new Map(categories.map((category) => [category.id, category]));
    for (const category of fallback) {
      if (!byId.has(category.id)) byId.set(category.id, category);
    }
    categories = Array.from(byId.values());
  }

  const result = suggestCategoriesFromTitle(title, categories);
  return NextResponse.json(result);
}

