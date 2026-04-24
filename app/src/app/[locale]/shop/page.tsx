/* eslint-disable @next/next/no-img-element */

import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildStoreMetadata } from "@/lib/storeSeo";

type ShopFilters = {
  type?: string;
  category?: string;
  store?: string;
  page?: string;
};

const PRODUCTS_PER_PAGE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: "/shop",
    title: isFr ? "Marketplace | JONTAADO Shop" : "Marketplace | JONTAADO Shop",
    description: isFr
      ? "Explore les produits locaux, preorder et dropship de la marketplace JONTAADO."
      : "Browse local, preorder and dropship products on the JONTAADO marketplace.",
    imagePath: "/logo.png",
  });
}

export default async function ShopPage({
  searchParams,
  params,
}: {
  searchParams: Promise<ShopFilters>;
  params: Promise<{ locale: string }>;
}) {
  const [{ type, category, store, page }, { locale }, t, session] = await Promise.all([
    searchParams,
    params,
    getTranslations("Shop"),
    getServerSession(authOptions),
  ]);

  const normalizedType = type?.toUpperCase();
  const activeCategory = category ?? undefined;
  const activeStore = store ?? undefined;
  const storeScopeSlug = activeStore ?? "marketplace";
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const now = new Date();

  const where: Prisma.ProductWhereInput = { isActive: true };

  if (
    normalizedType === "PREORDER" ||
    normalizedType === "DROPSHIP" ||
    normalizedType === "LOCAL"
  ) {
    where.type = normalizedType as "PREORDER" | "DROPSHIP" | "LOCAL";
  }

  if (activeCategory) {
    where.categories = {
      some: {
        OR: [
          { category: { slug: activeCategory } },
          { category: { parent: { slug: activeCategory } } },
        ],
      },
    };
  }

  if (activeStore) {
    where.store = { slug: activeStore };
  }

  const activeBoostWhere: Prisma.ProductWhereInput = {
    ...where,
    boostStatus: "APPROVED",
    OR: [{ boostedUntil: null }, { boostedUntil: { gt: now } }],
  };

  const nonBoostedWhere: Prisma.ProductWhereInput = {
    ...where,
    OR: [
      { boostStatus: { not: "APPROVED" } },
      { boostStatus: "APPROVED", boostedUntil: { lte: now } },
    ],
  };

  const pageOffset = (currentPage - 1) * PRODUCTS_PER_PAGE;

  const [productsTotalCount, activeBoostedCount, scopedCategories, stores] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: activeBoostWhere }),
    prisma.category.findMany({
      where: {
        isActive: true,
        stores: {
          some: {
            store: {
              slug: storeScopeSlug,
            },
          },
        },
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    }),
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const boostedSkip = Math.min(pageOffset, activeBoostedCount);
  const boostedTake = Math.max(
    0,
    Math.min(PRODUCTS_PER_PAGE, activeBoostedCount - boostedSkip)
  );
  const regularSkip = Math.max(0, pageOffset - activeBoostedCount);
  const regularTake = PRODUCTS_PER_PAGE - boostedTake;

  const [boostedProducts, regularProducts] = await Promise.all([
    boostedTake > 0
      ? prisma.product.findMany({
          where: activeBoostWhere,
          orderBy: [{ createdAt: "desc" }],
          skip: boostedSkip,
          take: boostedTake,
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            seller: { select: { displayName: true } },
          },
        })
      : Promise.resolve([]),
    regularTake > 0
      ? prisma.product.findMany({
          where: nonBoostedWhere,
          orderBy: [{ createdAt: "desc" }],
          skip: regularSkip,
          take: regularTake,
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            seller: { select: { displayName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const products = [...boostedProducts, ...regularProducts];

  const categories =
    scopedCategories.length > 0
      ? scopedCategories
      : await prisma.category.findMany({
          where: { isActive: true },
          include: {
            parent: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ parentId: "asc" }, { name: "asc" }],
        });

  const favoriteProductIds = session?.user?.id
    ? new Set(
        (
          await prisma.favorite.findMany({
            where: {
              userId: session.user.id,
              productId: { in: products.map((product) => product.id) },
            },
            select: { productId: true },
          })
        ).map((favorite) => favorite.productId)
      )
    : new Set<string>();

  const isBoosted = (product: (typeof products)[number]) =>
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > now);

  const totalPages = Math.max(1, Math.ceil(productsTotalCount / PRODUCTS_PER_PAGE));
  const visibleRangeStart = productsTotalCount === 0 ? 0 : (currentPage - 1) * PRODUCTS_PER_PAGE + 1;
  const visibleRangeEnd = Math.min(currentPage * PRODUCTS_PER_PAGE, productsTotalCount);

  const rootCategories = categories
    .filter((entry) => !entry.parentId)
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const childCategories = categories
    .filter((entry) => Boolean(entry.parentId))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const childrenByRootId = childCategories.reduce((map, entry) => {
    if (!entry.parentId) return map;
    if (!map.has(entry.parentId)) {
      map.set(entry.parentId, []);
    }
    map.get(entry.parentId)?.push(entry);
    return map;
  }, new Map<string, (typeof childCategories)[number][]>());

  const activeRootCategory =
    rootCategories.find((entry) => entry.slug === activeCategory) ??
    rootCategories.find((entry) =>
      (childrenByRootId.get(entry.id) ?? []).some(
        (child) => child.slug === activeCategory
      )
    );

  const visibleSubcategories = activeRootCategory
    ? childrenByRootId.get(activeRootCategory.id) ?? []
    : [];

  const sidebarRoots =
    rootCategories.length > 0
      ? rootCategories
      : categories.filter((entry) => !entry.parentId);

  const buildShopHref = ({
    type: nextType,
    category: nextCategory,
    store: nextStore,
    page: nextPage,
  }: {
    type?: string | null;
    category?: string | null;
    store?: string | null;
    page?: number | null;
  }) => {
    const params = new URLSearchParams();
    const filtersChanged =
      nextType !== undefined || nextCategory !== undefined || nextStore !== undefined;

    const finalType =
      nextType === undefined ? normalizedType : nextType ?? undefined;
    const finalCategory =
      nextCategory === undefined ? activeCategory : nextCategory ?? undefined;
    const finalStore =
      nextStore === undefined ? activeStore : nextStore ?? undefined;
    const finalPage =
      nextPage == undefined
        ? filtersChanged
          ? undefined
          : currentPage > 1
          ? currentPage
          : undefined
        : nextPage > 1
        ? nextPage
        : undefined;

    if (finalType) params.set("type", finalType);
    if (finalCategory) params.set("category", finalCategory);
    if (finalStore) params.set("store", finalStore);
    if (finalPage) params.set("page", String(finalPage));

    const query = params.toString();
    return query ? `/shop?${query}` : "/shop";
  };

  const categoryExplorerCards = (
    activeRootCategory ? visibleSubcategories : sidebarRoots
  ).slice(0, 24);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} containerClassName="max-w-6xl" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-[92px] sm:pt-[100px]">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                {t("hero.kicker")}
              </p>
              <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
                {t("hero.title")}
              </h1>
              <p className="mt-3 text-sm text-zinc-300">{t("hero.subtitle")}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 px-5 py-4 text-xs text-zinc-300">
              <span>{t("hero.metrics.title")}</span>
              <span className="text-sm font-semibold text-emerald-200">
                {productsTotalCount}
              </span>
              <span>{t("hero.metrics.note")}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 fade-up">
          <Link
            href={buildShopHref({ type: null, category: null, store: null })}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              !normalizedType
                ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.all")}
          </Link>
          <Link
            href="/stores"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/40"
          >
            {t("filters.storesLink")}
          </Link>
          <Link
            href={buildShopHref({ type: "PREORDER", category: null })}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              normalizedType === "PREORDER"
                ? "border-amber-300/60 bg-amber-300/10 text-amber-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.preorder")}
          </Link>
          <Link
            href={buildShopHref({ type: "DROPSHIP", category: null })}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              normalizedType === "DROPSHIP"
                ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.dropship")}
          </Link>
          <Link
            href={buildShopHref({ type: "LOCAL", category: null })}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              normalizedType === "LOCAL"
                ? "border-sky-300/60 bg-sky-300/10 text-sky-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.local")}
          </Link>
        </section>

        <section className="flex flex-wrap items-center gap-3 fade-up">
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            {t("filters.stores")}
          </span>
          <Link
            href={buildShopHref({ store: null })}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              !activeStore
                ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.all")}
          </Link>
          {stores.map((entry) => (
            <Link
              key={entry.id}
              href={buildShopHref({ store: entry.slug })}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeStore === entry.slug
                  ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                  : "border-white/15 text-zinc-300 hover:border-white/40"
              }`}
            >
              {entry.name}
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] fade-up">
          <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-4 lg:sticky lg:top-[108px]">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-400">
              {t("filters.categories")}
            </p>
            <div className="grid gap-2">
              <Link
                href={buildShopHref({ category: null })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  !activeCategory
                    ? "border-sky-300/60 bg-sky-300/10 text-sky-100"
                    : "border-white/10 text-zinc-300 hover:border-white/35"
                }`}
              >
                {t("filters.all")}
              </Link>

              {sidebarRoots.map((root) => {
                const rootChildren = childrenByRootId.get(root.id) ?? [];
                const isRootActive =
                  activeCategory === root.slug || activeRootCategory?.id === root.id;

                return (
                  <div
                    key={root.id}
                    className={`rounded-xl border px-3 py-2 transition ${
                      isRootActive
                        ? "border-sky-300/50 bg-sky-300/10"
                        : "border-white/10 bg-zinc-950/30 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={buildShopHref({ category: root.slug })}
                        className={`truncate text-xs font-semibold ${
                          isRootActive ? "text-sky-100" : "text-zinc-200"
                        }`}
                      >
                        {root.name}
                      </Link>
                      <span className="text-[10px] text-zinc-500">{rootChildren.length}</span>
                    </div>

                    {isRootActive && rootChildren.length > 0 && (
                      <div className="ml-2 mt-2 grid gap-1 border-l border-white/10 pl-3">
                        {rootChildren.map((child) => (
                          <Link
                            key={child.id}
                            href={buildShopHref({ category: child.slug })}
                            className={`text-[11px] transition ${
                              activeCategory === child.slug
                                ? "text-sky-200"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {activeRootCategory
                    ? `${activeRootCategory.name} ${locale === "fr" ? "- sous-categories" : "- subcategories"}`
                    : locale === "fr"
                    ? "Navigation categories"
                    : "Category navigation"}
                </p>
                <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400">
                  {categoryExplorerCards.length} {locale === "fr" ? "elements" : "items"}
                </span>
              </div>

              {categoryExplorerCards.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {activeRootCategory && (
                    <Link
                      key="root-all"
                      href={buildShopHref({ category: activeRootCategory.slug })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        activeCategory === activeRootCategory.slug
                          ? "border-sky-300/60 bg-sky-300/10 text-sky-100"
                          : "border-white/15 text-zinc-200 hover:border-white/35"
                      }`}
                    >
                      {locale === "fr" ? `Tout ${activeRootCategory.name}` : `All ${activeRootCategory.name}`}
                    </Link>
                  )}

                  {categoryExplorerCards.map((entry) => (
                    <Link
                      key={entry.id}
                      href={buildShopHref({ category: entry.slug })}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        activeCategory === entry.slug
                          ? "border-sky-300/60 bg-sky-300/10 text-sky-100"
                          : "border-white/15 text-zinc-200 hover:border-white/35"
                      }`}
                    >
                      <span className="truncate">{entry.name}</span>
                      <span className="text-[10px] text-zinc-500">
                        {activeCategory === entry.slug
                          ? locale === "fr"
                            ? "Actif"
                            : "Active"
                          : locale === "fr"
                          ? "Filtrer"
                          : "Filter"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  {locale === "fr"
                    ? "Aucune categorie disponible pour cette sous-boutique."
                    : "No category available for this store."}
                </p>
              )}
            </section>

            <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const boosted = isBoosted(product);
                const localStock =
                  product.type === "LOCAL"
                    ? Math.max(0, Math.floor(Number(product.stockQuantity ?? 0)))
                    : undefined;
                const isSoldOut = product.type === "LOCAL" && (localStock ?? 0) <= 0;
                const isLowStock =
                  product.type === "LOCAL" && (localStock ?? 0) > 0 && (localStock ?? 0) <= 3;
                return (
                  <Link
                    key={product.id}
                    href={`/shop/${product.slug}`}
                    className={`group rounded-3xl border bg-zinc-900/70 p-6 transition ${
                      boosted
                        ? "border-emerald-300/60 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                        : "border-white/10 hover:border-emerald-300/60"
                    }`}
                  >
                    <div className="relative mb-4 h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
                      <FavoriteButton
                        productId={product.id}
                        initialIsFavorite={favoriteProductIds.has(product.id)}
                        serverHydrated
                        variant="icon"
                        className="absolute left-3 top-3 z-20"
                      />
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].alt ?? product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                          Image a venir
                        </div>
                      )}
                      {boosted && (
                        <span
                          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-400/20 text-orange-200"
                          title={locale === "fr" ? "Produit booste" : "Boosted product"}
                          aria-label={locale === "fr" ? "Produit booste" : "Boosted product"}
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          >
                            <path d="M11.2 1.9L4.5 10h3.9l-1 8.1L15.5 9h-4l-.3-7.1z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          product.type === "PREORDER"
                            ? "bg-amber-400/20 text-amber-200"
                            : "bg-emerald-400/20 text-emerald-200"
                        }`}
                      >
                        {product.type === "PREORDER"
                          ? t("labels.preorder")
                          : product.type === "LOCAL"
                          ? t("labels.local")
                          : t("labels.dropship")}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {product.type === "PREORDER"
                          ? t("labels.eta", {
                              days: `${product.preorderLeadDays ?? 14} jours`,
                            })
                          : product.type === "LOCAL"
                          ? t("labels.localEta")
                          : t("labels.eta", { days: "5-10 jours" })}
                      </span>
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold">{product.title}</h3>
                      {isSoldOut ? (
                        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                          {locale === "fr" ? "Epuise" : "Sold out"}
                        </span>
                      ) : isLowStock ? (
                        <span className="shrink-0 rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200">
                          {locale === "fr" ? "Stock faible" : "Low stock"}
                        </span>
                      ) : null}
                    </div>
                    {product.discountPercent ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-emerald-200">
                          {formatMoney(
                            getDiscountedPrice(
                              product.priceCents,
                              product.discountPercent
                            ),
                            product.currency,
                            locale
                          )}
                        </span>
                        <span className="text-xs text-zinc-500 line-through">
                          {formatMoney(product.priceCents, product.currency, locale)}
                        </span>
                        <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                          -{product.discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-300">
                        {formatMoney(product.priceCents, product.currency, locale)}
                      </p>
                    )}
                    {isSoldOut ? (
                      <p className="mt-2 text-[11px] text-amber-100/80">
                        {locale === "fr"
                          ? "Momentanement indisponible."
                          : "Temporarily unavailable."}
                      </p>
                    ) : isLowStock ? (
                      <p className="mt-2 text-[11px] text-orange-100/80">
                        {locale === "fr"
                          ? `Plus que ${localStock} en stock.`
                          : `Only ${localStock} left.`}
                      </p>
                    ) : null}
                    <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                      <span>{product.seller?.displayName ?? t("labels.seller")}</span>
                      <span className="text-emerald-200 transition group-hover:text-emerald-100">
                        {t("labels.view")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </section>

            {productsTotalCount > PRODUCTS_PER_PAGE ? (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
                <p className="text-xs text-zinc-400">
                  {locale === "fr"
                    ? `${visibleRangeStart}-${visibleRangeEnd} sur ${productsTotalCount} produits`
                    : `${visibleRangeStart}-${visibleRangeEnd} of ${productsTotalCount} products`}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildShopHref({ page: currentPage - 1 })}
                    aria-disabled={currentPage <= 1}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      currentPage <= 1
                        ? "pointer-events-none border-white/10 text-zinc-600"
                        : "border-white/20 text-zinc-200 hover:border-white/40"
                    }`}
                  >
                    {locale === "fr" ? "Precedent" : "Previous"}
                  </Link>
                  <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300">
                    {currentPage} / {totalPages}
                  </span>
                  <Link
                    href={buildShopHref({ page: currentPage + 1 })}
                    aria-disabled={currentPage >= totalPages}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      currentPage >= totalPages
                        ? "pointer-events-none border-white/10 text-zinc-600"
                        : "border-white/20 text-zinc-200 hover:border-white/40"
                    }`}
                  >
                    {locale === "fr" ? "Suivant" : "Next"}
                  </Link>
                </div>
              </section>
            ) : null}
          </div>
        </section>

        {productsTotalCount === 0 && (
          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-10 text-center fade-up">
            <p className="text-sm text-zinc-300">{t("empty")}</p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

