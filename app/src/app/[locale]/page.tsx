import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import Footer from "@/components/layout/Footer";
import SearchBar from "@/components/search/SearchBar";
import UserHeaderActions from "@/components/layout/UserHeaderActions";
import HomeDynamicSignals from "@/components/home/HomeDynamicSignals";
import HomePromoPopups from "@/components/home/HomePromoPopups";
import RotatingSponsoredPlacement from "@/components/ads/RotatingSponsoredPlacement";
import ProductCardCarousel from "@/components/shop/ProductCardCarousel";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHomePromoEntries } from "@/lib/homePromos";
import { filterHomePromosForPlacement } from "@/lib/homePromos.shared";

const storeLogos: Record<string, string> = {
  "jontaado-immo": "/stores/immo.png",
  "jontaado-cars": "/stores/cars.png",
  "jontaado-presta": "/stores/presta.png",
  "jontaado-gp": "/stores/gp.png",
  "jontaado-tiak-tiak": "/stores/tiak.png",
};

const CARES_STORE_SLUGS = new Set(["jontaado-marketplace", "jontaado-shop"]);

function resolveHomeStoreCard(store: { slug: string; name: string; type: string }) {
  if (store.type === "MARKETPLACE" || CARES_STORE_SLUGS.has(store.slug)) {
    return {
      href: "/stores/jontaado-cares",
      logoSrc: "/stores/last_cares.png",
      srLabel: "JONTAADO CARES",
    };
  }

  return {
    href: `/stores/${store.slug}`,
    logoSrc: storeLogos[store.slug] ?? "/logo.png",
    srLabel: store.name,
  };
}

function resolveProductVerticalKey(product: {
  store?: { slug?: string | null; type?: string | null } | null;
  type?: string | null;
}) {
  if (product.store?.slug) {
    return CARES_STORE_SLUGS.has(product.store.slug) ? "jontaado-cares" : product.store.slug;
  }

  if (product.store?.type === "MARKETPLACE") {
    return "jontaado-cares";
  }

  if (product.type) {
    return product.type.toLowerCase();
  }

  return "unknown";
}

const homeProductSelect = {
  id: true,
  sellerId: true,
  slug: true,
  title: true,
  type: true,
  priceCents: true,
  currency: true,
  discountPercent: true,
  boostStatus: true,
  boostedUntil: true,
  createdAt: true,
  seller: { select: { displayName: true } },
  store: { select: { slug: true, type: true } },
  categories: { select: { categoryId: true } },
  _count: { select: { favorites: true } },
  images: { orderBy: { position: "asc" }, take: 5, select: { url: true, alt: true } },
} satisfies Prisma.ProductSelect;

const homeLikedProductSelect = {
  id: true,
  sellerId: true,
  slug: true,
  title: true,
  type: true,
  priceCents: true,
  currency: true,
  discountPercent: true,
  seller: { select: { displayName: true } },
  store: { select: { slug: true, type: true } },
  categories: { select: { categoryId: true } },
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.ProductSelect;

type HomeProduct = Prisma.ProductGetPayload<{ select: typeof homeProductSelect }>;
type HomeLikedProduct = Prisma.ProductGetPayload<{ select: typeof homeLikedProductSelect }>;
type HomePopularLikedProduct = Prisma.ProductGetPayload<{
  select: typeof homeLikedProductSelect & { _count: { select: { favorites: true } } };
}>;

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const [{ locale }, { q, category, sort }] = await Promise.all([
    params,
    searchParams,
  ]);
  const query = q?.trim();
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "price_asc"
      ? { priceCents: "asc" }
      : sort === "price_desc"
      ? { priceCents: "desc" }
      : { createdAt: "desc" };

  const [
    session,
    products,
    stores,
    categories,
    suggestions,
    sellerHints,
    sidebarRootCategories,
    homePromoConfig,
  ] = await Promise.all([
    getServerSession(authOptions),
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(category
          ? {
              categories: {
                some: {
                  category: {
                    OR: [{ slug: category }, { parent: { slug: category } }],
                  },
                },
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { seller: { displayName: { contains: query, mode: "insensitive" } } },
                {
                  categories: {
                    some: { category: { name: { contains: query, mode: "insensitive" } } },
                  },
                },
                { store: { name: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy,
      take: 24,
      select: homeProductSelect,
    }) as Prisma.PrismaPromise<HomeProduct[]>,
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
    getHomePromoEntries(),
  ]);

  const now = new Date();
  const isBoosted = (product: typeof products[number]) =>
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > now);

  const sortedProducts: HomeProduct[] = [...products].sort((a, b) => {
    const boostDiff = Number(isBoosted(b)) - Number(isBoosted(a));
    if (boostDiff !== 0) return boostDiff;
    if (sort === "price_asc") return a.priceCents - b.priceCents;
    if (sort === "price_desc") return b.priceCents - a.priceCents;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const displayedProducts = sortedProducts.slice(0, 12);
  const storeHints = stores.slice(0, 6).map((item) => ({ name: item.name }));
  const displayedProductIds = displayedProducts.map((product) => product.id);

  const [operatorProfile, favoriteEntries, recentLikedEntries, popularLikedProducts] = await Promise.all([
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            name: true,
            role: true,
            sellerProfile: { select: { id: true } },
            kycSubmissions: {
              where: {
                status: "APPROVED",
                targetRole: { in: ["SELLER", "TRANSPORTER", "COURIER"] },
              },
              select: { id: true },
              take: 1,
            },
          },
        })
      : Promise.resolve(null),
    session?.user?.id && displayedProductIds.length > 0
      ? prisma.favorite.findMany({
          where: {
            userId: session.user.id,
            productId: { in: displayedProductIds },
          },
          select: { productId: true },
        })
      : Promise.resolve([]),
    session?.user?.id
      ? prisma.favorite.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            productId: true,
            createdAt: true,
            product: { select: homeLikedProductSelect },
          },
        }) as Promise<Array<{ productId: string; createdAt: Date; product: HomeLikedProduct }>>
      : Promise.resolve([]),
    !session?.user?.id
      ? prisma.product.findMany({
          where: { isActive: true },
          orderBy: [{ favorites: { _count: "desc" } }, { createdAt: "desc" }],
          take: 4,
          select: {
            ...homeLikedProductSelect,
            _count: { select: { favorites: true } },
          },
        }) as Prisma.PrismaPromise<HomePopularLikedProduct[]>
      : Promise.resolve([]),
  ]);

  const favoriteProductIds = new Set(favoriteEntries.map((entry) => entry.productId));
  const hasOperatorProfile =
    Boolean(operatorProfile?.sellerProfile) ||
    Boolean(operatorProfile?.kycSubmissions?.length) ||
    operatorProfile?.role === "SELLER" ||
    operatorProfile?.role === "COURIER" ||
    operatorProfile?.role === "TRANSPORTER";

  const firstName = operatorProfile?.name?.trim().split(/\s+/)[0] ?? "";
  const operatorGreeting =
    locale === "fr"
      ? `Ravis de vous retrouver${firstName ? `, ${firstName}` : ""}`
      : `Welcome back${firstName ? `, ${firstName}` : ""}`;
  const operatorCta =
    locale === "fr" ? "Aller a votre espace" : "Go to your workspace";
  const startOperatorCta =
    locale === "fr"
      ? "Ouvrez votre espace vendeur / livreur / GP"
      : "Open your seller / courier / GP space";
  const loginToStartCta =
    locale === "fr" ? "Se connecter pour commencer" : "Sign in to get started";

  const operatorSpaceHref =
    operatorProfile?.sellerProfile || operatorProfile?.role === "SELLER"
      ? "/seller"
      : "/profile";

  const orderedSidebarRoots = [...sidebarRootCategories].sort((a, b) =>
    a.name.localeCompare(b.name, locale)
  );
  const categoryLabelById = new Map(
    orderedSidebarRoots.flatMap((root) => [
      [root.id, root.name] as const,
      ...root.children.map((child) => [child.id, child.name] as const),
    ])
  );
  const homeLikedItems = session?.user?.id
    ? recentLikedEntries.map((entry) => ({
        productId: entry.productId,
        slug: entry.product.slug,
        title: entry.product.title,
        type: entry.product.type,
        priceCents: entry.product.priceCents,
        currency: entry.product.currency,
        discountPercent: entry.product.discountPercent,
        sellerName: entry.product.seller?.displayName ?? null,
        imageUrl: entry.product.images[0]?.url ?? null,
        imageAlt: entry.product.images[0]?.alt ?? null,
        likedAt: entry.createdAt.toISOString(),
      }))
    : popularLikedProducts.map((product) => ({
        productId: product.id,
        slug: product.slug,
        title: product.title,
        type: product.type,
        priceCents: product.priceCents,
        currency: product.currency,
        discountPercent: product.discountPercent,
        sellerName: product.seller?.displayName ?? null,
        imageUrl: product.images[0]?.url ?? null,
        imageAlt: product.images[0]?.alt ?? null,
        favoritesCount: product._count.favorites,
      }));
  const likedCategoryIds = Array.from(
    new Set(
      recentLikedEntries.flatMap((entry) =>
        entry.product.categories.map((categoryEntry) => categoryEntry.categoryId)
      )
    )
  );
  const likedSellerIds = Array.from(
    new Set(recentLikedEntries.map((entry) => entry.product.sellerId))
  );
  const likedVerticalKeys = Array.from(
    new Set(recentLikedEntries.map((entry) => resolveProductVerticalKey(entry.product)))
  );
  const recommendationSignals = [
    ...likedCategoryIds
      .map((categoryId) => categoryLabelById.get(categoryId))
      .filter((value): value is string => Boolean(value))
      .slice(0, 2),
    ...likedVerticalKeys
      .map((key) => {
        if (key === "jontaado-cares") return "CARES";
        if (key === "jontaado-presta") return "PRESTA";
        if (key === "jontaado-gp") return "GP";
        if (key === "jontaado-tiak-tiak") return "TIAK";
        if (key === "jontaado-cars") return "CARS";
        if (key === "jontaado-immo") return "IMMO";
        return null;
      })
      .filter((value): value is "CARES" | "PRESTA" | "GP" | "TIAK" | "CARS" | "IMMO" => value !== null)
      .slice(0, 2),
  ].slice(0, 4);
  const recommendationSeedIds = new Set([
    ...displayedProductIds,
    ...recentLikedEntries.map((entry) => entry.productId),
  ]);

  const recommendationOrFilters: Prisma.ProductWhereInput[] = [];
  if (likedCategoryIds.length > 0) {
    recommendationOrFilters.push({
      categories: {
        some: {
          categoryId: { in: likedCategoryIds },
        },
      },
    });
  }
  if (likedSellerIds.length > 0) {
    recommendationOrFilters.push({
      sellerId: { in: likedSellerIds },
    });
  }
  if (likedVerticalKeys.includes("jontaado-cares")) {
    recommendationOrFilters.push({
      OR: [
        { store: { is: { slug: { in: Array.from(CARES_STORE_SLUGS) } } } },
        { store: { is: { type: "MARKETPLACE" } } },
      ],
    });
  }
  const explicitVerticalSlugs = likedVerticalKeys.filter(
    (key) => key.startsWith("jontaado-") && key !== "jontaado-cares"
  );
  if (explicitVerticalSlugs.length > 0) {
    recommendationOrFilters.push({
      store: {
        is: {
          slug: { in: explicitVerticalSlugs },
        },
      },
    });
  }

  let recommendedProducts: HomeProduct[] =
    session?.user?.id && recommendationOrFilters.length > 0
      ? ((await prisma.product.findMany({
          where: {
            isActive: true,
            id: { notIn: Array.from(recommendationSeedIds) },
            OR: recommendationOrFilters,
          },
          orderBy: [{ boostStatus: "desc" }, { createdAt: "desc" }],
          take: 18,
          select: homeProductSelect,
        })) as HomeProduct[])
      : [];

  recommendedProducts = recommendedProducts
    .sort((left, right) => {
      const leftCategoryMatches = left.categories.filter((item) => likedCategoryIds.includes(item.categoryId)).length;
      const rightCategoryMatches = right.categories.filter((item) => likedCategoryIds.includes(item.categoryId)).length;
      const leftSellerBoost = likedSellerIds.includes(left.sellerId) ? 4 : 0;
      const rightSellerBoost = likedSellerIds.includes(right.sellerId) ? 4 : 0;
      const leftVerticalBoost = likedVerticalKeys.includes(resolveProductVerticalKey(left)) ? 3 : 0;
      const rightVerticalBoost = likedVerticalKeys.includes(resolveProductVerticalKey(right)) ? 3 : 0;
      const leftBoosted = Number(isBoosted(left)) * 2;
      const rightBoosted = Number(isBoosted(right)) * 2;

      const leftScore = leftCategoryMatches * 3 + leftSellerBoost + leftVerticalBoost + leftBoosted + Math.min(left._count.favorites, 6);
      const rightScore = rightCategoryMatches * 3 + rightSellerBoost + rightVerticalBoost + rightBoosted + Math.min(right._count.favorites, 6);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 4);

  if (recommendedProducts.length < 4) {
    const fillerIds = new Set([
      ...Array.from(recommendationSeedIds),
      ...recommendedProducts.map((product) => product.id),
    ]);
    const localFallback = sortedProducts
      .filter((product) => !fillerIds.has(product.id))
      .slice(0, 4 - recommendedProducts.length);

    recommendedProducts = [...recommendedProducts, ...localFallback];

    if (recommendedProducts.length < 4) {
      const missingFallback = await prisma.product.findMany({
        where: {
          isActive: true,
          id: {
            notIn: [
              ...Array.from(fillerIds),
              ...recommendedProducts.map((product) => product.id),
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4 - recommendedProducts.length,
        select: homeProductSelect,
      });

      recommendedProducts = [...recommendedProducts, ...missingFallback];
    }
  }

  const hasActiveSearchIntent = Boolean(query || category || (sort && sort !== "recent"));
  const homeInlinePromos = filterHomePromosForPlacement(homePromoConfig.entries, {
    placement: "HOME_INLINE",
    isLoggedIn: Boolean(session?.user?.id),
  });
  const homeProductCardPromos = filterHomePromosForPlacement(homePromoConfig.entries, {
    placement: "HOME_PRODUCT_CARD",
    isLoggedIn: Boolean(session?.user?.id),
  });

  const dynamicSignalsSection = (
    <div className="fade-up">
      <HomeDynamicSignals
        locale={locale}
        isLoggedIn={Boolean(session?.user?.id)}
        initialLikedItems={homeLikedItems}
      />
    </div>
  );

  const recommendationsSection =
    recommendedProducts.length > 0 ? (
      <div className="fade-up">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/90">
              {locale === "fr" ? "Recommande pour vous" : "Recommended for you"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {locale === "fr"
                ? "Une selection qui colle mieux a votre rythme"
                : "A selection that better matches your rhythm"}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {locale === "fr"
                ? "Basee sur vos derniers signaux, vos favoris et les produits qui performent bien."
                : "Based on your recent signals, your favorites and products performing well."}
            </p>
            {recommendationSignals.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {recommendationSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-100"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <Link
            href="/shop"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-emerald-300/35 hover:bg-white/10"
          >
            {locale === "fr" ? "Voir plus" : "See more"}
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {recommendedProducts.map((product) => {
            const boosted = isBoosted(product);
            const finalPrice = product.discountPercent
              ? getDiscountedPrice(product.priceCents, product.discountPercent)
              : product.priceCents;

            return (
              <Link
                key={`recommended-${product.id}`}
                href={`/shop/${product.slug}`}
                className={`rounded-3xl border bg-zinc-900/70 p-5 transition ${
                  boosted
                    ? "border-emerald-300/45 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
                    : "border-white/10 hover:border-emerald-300/35"
                }`}
              >
                <div className="relative mb-4 h-28 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
                  <ProductCardCarousel
                    images={product.images}
                    title={product.title}
                    locale={locale}
                  />
                </div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  {product.seller?.displayName ?? "JONTAADO"}
                </p>
                <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">
                  {product.title}
                </h3>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatMoney(finalPrice, product.currency, locale)}
                  </span>
                  {product.discountPercent ? (
                    <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                      -{product.discountPercent}%
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    ) : null;

  const resultsSection = (
    <>
      <div className="fade-up">
        <h2 className="text-2xl font-semibold">
          {query ? `Resultats pour "${query}"` : "Produits disponibles"}
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          {query
            ? `${displayedProducts.length} resultat(s) trouve(s).`
            : "Les offres les plus recentes dans toutes les categories."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 fade-up">
        {displayedProducts.map((product, index) => {
          const boosted = isBoosted(product);
          const chunkIndex = Math.floor(index / 6);
          const shouldInsertProductCardPromo =
            !hasActiveSearchIntent &&
            homeProductCardPromos.length > 0 &&
            (index + 1) % 6 === 0 &&
            !(homeInlinePromos.length > 0 && chunkIndex === 0);
          return (
            <Fragment key={product.id}>
              <Link
                href={`/shop/${product.slug}`}
                className={`rounded-3xl border bg-zinc-900/70 p-6 transition ${
                  boosted
                    ? "border-emerald-300/60 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                    : "border-white/10 hover:border-emerald-300/60"
                }`}
              >
                <div className="relative mb-4 h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
                  <FavoriteButton
                    productId={product.id}
                    initialIsFavorite={favoriteProductIds.has(product.id)}
                    variant="icon"
                    className="absolute left-3 top-3 z-20"
                  />
                  <ProductCardCarousel
                    images={product.images}
                    title={product.title}
                    locale={locale}
                  />
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
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{product.type}</span>
                  <span>{product.seller?.displayName ?? "JONTAADO"}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{product.title}</h3>
                {product.discountPercent ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-emerald-200">
                      {formatMoney(
                        getDiscountedPrice(product.priceCents, product.discountPercent),
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
              </Link>

              {!hasActiveSearchIntent && homeInlinePromos.length > 0 && index === 1 ? (
                <div className="md:hidden">
                  <RotatingSponsoredPlacement
                    locale={locale}
                    promos={homeInlinePromos}
                    variant="inline"
                  />
                </div>
              ) : null}

              {!hasActiveSearchIntent && homeInlinePromos.length > 0 && index === 3 ? (
                <div className="hidden md:block md:col-span-2 xl:hidden">
                  <RotatingSponsoredPlacement
                    locale={locale}
                    promos={homeInlinePromos}
                    variant="inline"
                  />
                </div>
              ) : null}

              {!hasActiveSearchIntent && homeInlinePromos.length > 0 && index === 5 ? (
                <div className="hidden xl:block xl:col-span-3">
                  <RotatingSponsoredPlacement
                    locale={locale}
                    promos={homeInlinePromos}
                    variant="inline"
                  />
                </div>
              ) : null}

              {shouldInsertProductCardPromo ? (
                <div>
                  <RotatingSponsoredPlacement
                    locale={locale}
                    promos={homeProductCardPromos}
                    variant="product-card"
                    initialIndex={chunkIndex}
                  />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </>
  );


  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 fade-up xl:flex-row xl:items-center xl:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[72px] w-auto md:h-[86px]"
            priority
          />
        </Link>
        <div className="w-full xl:max-w-[560px] xl:flex-1 xl:px-6">
          <SearchBar
            initialQuery={query}
            initialCategory={category}
            initialSort={sort}
            categories={categories}
            suggestions={[
              ...suggestions.map((item) => item.title),
              ...sellerHints.map((item) => item.displayName),
              ...storeHints.map((item) => item.name),
            ]}
          />
        </div>
        <UserHeaderActions
          locale={locale}
          showSellerLink
          className="flex items-center gap-2 text-sm xl:shrink-0"
        />
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pb-24 md:grid-cols-[190px_1fr] lg:grid-cols-[190px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-4 fade-up">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300">
            Categories
          </div>
          <div className="mt-2.5 space-y-1.5">
            {orderedSidebarRoots.map((root) => {
              const isActiveRoot =
                category === root.slug ||
                root.children.some((child) => child.slug === category);

              if (root.children.length === 0) {
                return (
                  <Link
                    key={root.id}
                    href={`/shop?category=${root.slug}`}
                    className={`block rounded-lg px-2.5 py-1 text-[11px] transition ${
                      isActiveRoot
                        ? "bg-emerald-300/10 text-emerald-100"
                        : "text-zinc-200 hover:bg-zinc-950/40 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{root.name}</span>
                  </Link>
                );
              }

              return (
                <details key={root.id} className="border-b border-white/10 pb-1">
                  <summary
                    className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] transition marker:content-[''] ${
                      isActiveRoot
                        ? "text-emerald-100"
                        : "text-zinc-200 hover:bg-zinc-950/40 hover:text-white"
                    }`}
                  >
                    <Link
                      href={`/shop?category=${root.slug}`}
                      className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                    >
                      {root.name}
                    </Link>
                    <span className="shrink-0 text-[10px] text-zinc-500">v</span>
                  </summary>
                  <div className="mt-1 space-y-1 pl-3">
                    {root.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/shop?category=${child.slug}`}
                        className={`block rounded-md px-2 py-1 text-[10px] transition ${
                          category === child.slug
                            ? "bg-emerald-300/10 text-emerald-100"
                            : "text-zinc-300 hover:bg-zinc-950/40 hover:text-white"
                        }`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          <Link
            href="/shop"
            className="mt-4 block rounded-full bg-emerald-400 px-4 py-1.5 text-center text-xs font-semibold text-zinc-950"
          >
            Voir tout
          </Link>
        </aside>

        <section className="flex flex-col gap-8">
          <div className="-mt-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-[2.2px] card-glow fade-up">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {stores.map((store) => {
                const storeCard = resolveHomeStoreCard(store);

                return (
                  <Link
                    key={store.id}
                    href={storeCard.href}
                    className="flex flex-col items-center gap-0.5 rounded-2xl border border-transparent bg-transparent px-1 py-1 text-center text-xs text-zinc-200 transition hover:border-emerald-300/40"
                  >
                    <Image
                      src={storeCard.logoSrc}
                      alt={`${storeCard.srLabel} logo`}
                      width={252}
                      height={252}
                      className="h-[106px] w-[165px] object-contain"
                    />
                    <span className="sr-only">{storeCard.srLabel}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="-mt-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-[2.2px] card-glow fade-up">
            {session ? (
              hasOperatorProfile ? (
                <Link
                  href={operatorSpaceHref}
                  className="group flex w-full items-center justify-between rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-[0_10px_24px_rgba(16,185,129,0.16)]"
                >
                  <span className="text-sm font-semibold text-white">{operatorGreeting}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                    {operatorCta}<span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
                  </span>
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="group flex w-full items-center justify-between rounded-2xl border border-white/15 bg-zinc-950/50 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                >
                  <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-emerald-200 bg-[length:200%_100%] bg-[position:0%_50%] bg-clip-text text-sm font-semibold text-transparent transition-[background-position,letter-spacing] duration-500 group-hover:bg-[position:100%_50%] group-hover:tracking-[0.01em]">{startOperatorCta}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
                    {operatorCta}<span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
                  </span>
                </Link>
              )
            ) : (
              <Link
                href="/login"
                className="group flex w-full items-center justify-between rounded-2xl border border-white/15 bg-zinc-950/50 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
              >
                <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-emerald-200 bg-[length:200%_100%] bg-[position:0%_50%] bg-clip-text text-sm font-semibold text-transparent transition-[background-position,letter-spacing] duration-500 group-hover:bg-[position:100%_50%] group-hover:tracking-[0.01em]">{startOperatorCta}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  {loginToStartCta}<span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
                </span>
              </Link>
            )}
          </div>

          {hasActiveSearchIntent ? (
            <>
              {resultsSection}
              {recommendationsSection}
              {dynamicSignalsSection}
            </>
          ) : (
            <>
              {dynamicSignalsSection}
              {recommendationsSection}
              {resultsSection}
            </>
          )}
        </section>
      </main>
      <HomePromoPopups
        locale={locale}
        promos={homePromoConfig.entries}
        isLoggedIn={Boolean(session?.user?.id)}
      />
      <Footer />
    </div>
  );
}




