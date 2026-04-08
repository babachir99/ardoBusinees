import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const getHeaderSearchSnapshot = unstable_cache(
  async () => {
    const [categories, recentProducts] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        take: 24,
        select: { name: true, slug: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { title: true },
      }),
    ]);

    return { categories, recentProducts };
  },
  ["header-search-snapshot"],
  { revalidate: 300 }
);

export const getHomeShellSnapshot = unstable_cache(
  async () => {
    const [stores, categories, suggestions, sellerHints, sidebarRootCategories] =
      await Promise.all([
        prisma.store.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, slug: true, name: true, type: true },
        }),
        prisma.category.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { name: true, slug: true },
        }),
        prisma.product.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { title: true },
        }),
        prisma.sellerProfile.findMany({
          orderBy: { displayName: "asc" },
          take: 6,
          select: { displayName: true },
        }),
        prisma.category.findMany({
          where: {
            isActive: true,
            parentId: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            children: {
              where: {
                isActive: true,
              },
              orderBy: { name: "asc" },
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { name: "asc" },
        }),
      ]);

    return {
      stores,
      categories,
      suggestions,
      sellerHints,
      sidebarRootCategories,
    };
  },
  ["home-shell-snapshot"],
  { revalidate: 300 }
);
