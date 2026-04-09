/* eslint-disable @next/next/no-img-element */

import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import { getTranslations } from "next-intl/server";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import ProductPurchasePanel from "@/components/shop/ProductPurchasePanel";
import PurchaseInfoPanel from "@/components/shop/PurchaseInfoPanel";
import ProductReviewsPanel from "@/components/shop/ProductReviewsPanel";
import UserHeaderActions from "@/components/layout/UserHeaderActions";
import RecentProductViewTracker from "@/components/home/RecentProductViewTracker";

import FavoriteButton from "@/components/favorites/FavoriteButton";
type RelatedProductCard = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  discountPercent: number | null;
  currency: string;
  images: { url: string; alt: string | null }[];
  seller: { displayName: string; rating?: number | null } | null;
};

function getStars(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  const filled = Math.round(safe);
  return `${"\u2605".repeat(filled)}${"\u2606".repeat(5 - filled)}`;
}

function normalizeStringArray(
  values: string[] | null | undefined,
  maxItems = 20,
  maxLength = 64
): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0)
        .map((value) => value.slice(0, maxLength))
    )
  ).slice(0, maxItems);
}

function readAttributeEntries(
  raw: unknown
): Array<{ key: string; value: string }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  return Object.entries(raw as Record<string, unknown>)
    .map(([key, value]) => ({
      key: String(key ?? "").trim(),
      value: String(value ?? "").trim(),
    }))
    .filter((entry) => entry.key.length > 0 && entry.value.length > 0)
    .slice(0, 24);
}

function formatAttributeLabel(key: string, locale: string) {
  const normalized = key
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  const map: Record<string, { fr: string; en: string }> = {
    brand: { fr: "Marque", en: "Brand" },
    model: { fr: "Modele", en: "Model" },
    year: { fr: "Annee", en: "Year" },
    mileage: { fr: "Kilometrage", en: "Mileage" },
    fuel: { fr: "Carburant", en: "Fuel" },
    condition: { fr: "Etat", en: "Condition" },
    material: { fr: "Matiere", en: "Material" },
    gender: { fr: "Genre", en: "Gender" },
    collection: { fr: "Collection", en: "Collection" },
    surface: { fr: "Surface", en: "Area" },
    rooms: { fr: "Pieces", en: "Rooms" },
    location: { fr: "Zone", en: "Location" },
    warranty: { fr: "Garantie", en: "Warranty" },
  };

  if (map[normalized]) {
    return locale === "fr" ? map[normalized].fr : map[normalized].en;
  }

  return normalized
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ chat?: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const openChatDefault =
    resolvedSearchParams?.chat === "1" || resolvedSearchParams?.chat === "true";
  const session = await getServerSession(authOptions);
  const t = await getTranslations("Product");
  const normalizedSlug = slugify(slug);
  const slugCandidates =
    normalizedSlug && normalizedSlug !== slug ? [slug, normalizedSlug] : [slug];

  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: slugCandidates.map((candidate) => ({ slug: candidate })),
    },
    include: {
      seller: {
        include: {
          user: { select: { email: true, phone: true, image: true } },
        },
      },
      images: { orderBy: { position: "asc" } },
      categories: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  if (product.slug !== slug) {
    redirect(`/${locale}/shop/${product.slug}${openChatDefault ? "?chat=1" : ""}`);
  }

  const sellerProductsCount = await prisma.product.count({
    where: { sellerId: product.sellerId, isActive: true },
  });

  const demandWindowStart = new Date();
  demandWindowStart.setDate(demandWindowStart.getDate() - 14);

  const [
    recentSalesCount,
    totalSalesCount,
    favoritesCount,
    sellerSalesCount,
    sellerRatingStats,
  ] =
    await Promise.all([
      prisma.orderItem.count({
        where: {
          productId: product.id,
          order: { paymentStatus: "PAID", createdAt: { gte: demandWindowStart } },
        },
      }),
      prisma.orderItem.count({
        where: {
          productId: product.id,
          order: { paymentStatus: "PAID" },
        },
      }),
      prisma.favorite.count({ where: { productId: product.id } }),
      prisma.order.count({
        where: { sellerId: product.sellerId, paymentStatus: "PAID" },
      }),
      prisma.productReview.aggregate({
        where: { sellerId: product.sellerId, sellerRating: { not: null } },
        _avg: { sellerRating: true },
        _count: { _all: true },
      }),
    ]);

  const isHotDemand = recentSalesCount >= 3 || favoritesCount >= 8;
  const isLowStock =
    product.type === "LOCAL" &&
    product.stockQuantity !== null &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= 3;

  const categoryIds = product.categories.map((entry) => entry.categoryId);
  const similarProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      categories: {
        some: { categoryId: { in: categoryIds.length > 0 ? categoryIds : ["__none__"] } },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      seller: { select: { displayName: true, rating: true } },
    },
    take: 8,
  });

  const complementaryCandidates = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      OR: [{ sellerId: product.sellerId }, { type: product.type }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      seller: { select: { displayName: true, rating: true } },
    },
    take: 12,
  });

  const similarIds = new Set(similarProducts.map((item) => item.id));
  const bundleProducts = complementaryCandidates
    .filter((item) => !similarIds.has(item.id))
    .slice(0, 8);

  const explicitColorOptions = normalizeStringArray(product.colorOptions, 20, 40);
  const explicitSizeOptions = normalizeStringArray(product.sizeOptions, 20, 32);
  const attributeEntries = readAttributeEntries(product.attributes);

  const sizeCategorySlugs = new Set(["vetements", "chaussures", "enfants", "mode"]);
  const colorCategorySlugs = new Set([
    "vetements",
    "chaussures",
    "cosmetiques",
    "maison",
    "electronique",
    "local",
  ]);

  const showSizeOptions =
    explicitSizeOptions.length > 0 ||
    product.categories.some((entry) => sizeCategorySlugs.has(entry.category.slug));
  const showColorOptions =
    explicitColorOptions.length > 0 ||
    product.categories.some((entry) => colorCategorySlugs.has(entry.category.slug)) ||
    product.type === "LOCAL";

  const sellerPhone = product.seller?.user?.phone?.trim();
  const isSellerOwner = session?.user?.id === product.seller?.userId;
  const sellerEmail = product.seller?.user?.email?.trim();

  const sellerPhoneHref = sellerPhone ? `tel:${sellerPhone}` : undefined;
  const sellerEmailHref = sellerEmail
    ? `mailto:${sellerEmail}?subject=${encodeURIComponent(product.title)}`
    : undefined;

  let whatsappNumber = sellerPhone ? sellerPhone.replace(/[^0-9]/g, "") : "";
  if (whatsappNumber.startsWith("00")) whatsappNumber = whatsappNumber.slice(2);
  if (whatsappNumber.length === 9) whatsappNumber = `221${whatsappNumber}`;
  const sellerWhatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        locale === "fr"
          ? `Bonjour, je suis interesse par ${product.title}`
          : `Hello, I am interested in ${product.title}`
      )}`
    : undefined;

  const typeLabel =
    product.type === "PREORDER"
      ? t("badge.preorder")
      : product.type === "LOCAL"
      ? t("badge.local")
      : t("badge.dropship");
  const etaLabel =
    product.type === "PREORDER"
      ? t("badge.preorderEta", { days: product.preorderLeadDays ?? 14 })
      : product.type === "LOCAL"
      ? t("badge.localEta")
      : t("badge.dropshipEta");
  const priceLabel = formatMoney(product.priceCents, product.currency, locale);
  const discountedCents = getDiscountedPrice(product.priceCents, product.discountPercent);
  const hasDiscount =
    product.discountPercent !== null &&
    product.discountPercent !== undefined &&
    product.discountPercent > 0;
  const discountedLabel = formatMoney(discountedCents, product.currency, locale);
  const boosted =
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > new Date());
  const sellerRatingAverage = sellerRatingStats._avg.sellerRating;
  const sellerScore =
    typeof sellerRatingAverage === "number"
      ? sellerRatingAverage
      : product.seller?.rating ?? 5;
  const sellerRatingCount = sellerRatingStats._count._all;
  const reviewDelegate = prisma.productReview;

  const [reviewStats, latestReviews, paidOrderItem] = await Promise.all([
    reviewDelegate.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    reviewDelegate.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        buyer: { select: { id: true, name: true, image: true } },
      },
    }),
    session?.user?.id
      ? prisma.orderItem.findFirst({
          where: {
            productId: product.id,
            order: {
              userId: session.user.id,
              paymentStatus: "PAID",
            },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const reviewAverage = reviewStats._avg.rating ?? 0;
  const reviewCount = reviewStats._count._all;
  const reviewItems = latestReviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    sellerRating: review.sellerRating,
    title: review.title,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    mine: review.buyerId === session?.user?.id,
    buyer: review.buyer,
  }));
  const canReview = Boolean(session?.user?.id && paidOrderItem && !isSellerOwner);

  const relatedProductIds = Array.from(
    new Set([...similarProducts, ...bundleProducts].map((item) => item.id))
  );
  const relatedRatingMap = new Map<string, { average: number; count: number }>();

  if (relatedProductIds.length > 0) {
    const relatedRatingStats = await reviewDelegate.groupBy({
      by: ["productId"],
      where: { productId: { in: relatedProductIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    for (const stat of relatedRatingStats) {
      relatedRatingMap.set(stat.productId, {
        average: stat._avg.rating ?? 0,
        count: stat._count._all,
      });
    }
  }
  const renderProductCard = (item: RelatedProductCard) => (
    <Link
      key={item.id}
      href={`/shop/${item.slug}`}
      className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 transition hover:border-emerald-300/60"
    >
      <div className="relative h-36 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
        <FavoriteButton
          productId={item.id}
          variant="icon"
          className="absolute left-3 top-3 z-20"
        />
        {item.images[0]?.url ? (
          <img
            src={item.images[0].url}
            alt={item.images[0].alt ?? item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
            {locale === "fr" ? "Image a venir" : "Image coming soon"}
          </div>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-white">{item.title}</h3>
      <p className="mt-1 text-xs text-zinc-400">{item.seller?.displayName ?? "-"}</p>
      <p className="mt-2 text-sm font-semibold text-emerald-200">
        {formatMoney(
          getDiscountedPrice(item.priceCents, item.discountPercent),
          item.currency,
          locale
        )}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
        <div className="min-w-0">
          <p className="truncate">{locale === "fr" ? "Produit" : "Product"}</p>
          {(() => {
            const rating = relatedRatingMap.get(item.id);
            if (rating && rating.count > 0) {
              return (
                <p className="mt-0.5 flex items-center gap-1">
                  <span className="tracking-[0.06em] text-amber-300">
                    {getStars(rating.average)}
                  </span>
                  <span className="text-zinc-400">
                    {rating.average.toFixed(1)} ({rating.count} {locale === "fr" ? "avis" : "reviews"})
                  </span>
                </p>
              );
            }
            return (
              <p className="mt-0.5 text-zinc-500">{locale === "fr" ? "Nouveau" : "New"}</p>
            );
          })()}
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate">{locale === "fr" ? "Vendeur" : "Seller"}</p>
          {typeof item.seller?.rating === "number" ? (
            <p className="mt-0.5 flex items-center justify-end gap-1">
              <span className="tracking-[0.06em] text-amber-300">
                {getStars(item.seller.rating)}
              </span>
              <span className="text-zinc-400">{item.seller.rating.toFixed(1)}/5</span>
            </p>
          ) : (
            <p className="mt-0.5 text-zinc-500">{locale === "fr" ? "Nouveau" : "New"}</p>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <RecentProductViewTracker
        product={{
          id: product.id,
          slug: product.slug,
          title: product.title,
          priceCents: product.priceCents,
          currency: product.currency,
          discountPercent: product.discountPercent,
          sellerName: product.seller?.displayName ?? null,
          imageUrl: product.images[0]?.url ?? null,
        }}
        storageScope={session?.user?.id ?? null}
      />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="JONTAADO logo"
            className="h-[115px] w-auto md:h-[135px]"
          />
        </Link>
        <UserHeaderActions locale={locale} className="flex items-center gap-3" />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-12 md:flex-row">
        <section className="flex-1 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/10 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">
              {typeLabel}
            </span>
            <span>{etaLabel}</span>
            {boosted && (
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-400/20 text-orange-200"
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
            {isHotDemand && (
              <span className="rounded-full bg-orange-400/20 px-3 py-1 text-orange-200">
                {locale === "fr" ? "Tres demande" : "In demand"}
              </span>
            )}
            {isLowStock && (
              <span className="rounded-full bg-rose-400/20 px-3 py-1 text-rose-200">
                {locale === "fr" ? "Bientot fini" : "Almost sold out"}
              </span>
            )}
          </div>

          <h1 className="mt-6 text-3xl font-semibold">{product.title}</h1>
          <p className="mt-3 text-sm text-zinc-300">{product.description ?? t("subtitle")}</p>

          <ProductPurchasePanel
            locale={locale}
            productId={product.id}
            slug={product.slug}
            title={product.title}
            priceCents={hasDiscount ? discountedCents : product.priceCents}
            currency={product.currency}
            type={product.type}
            sellerName={product.seller?.displayName ?? undefined}
            stockQuantity={product.stockQuantity}
            images={product.images}
            addLabel={t("cta.add")}
            addedLabel={t("cta.added")}
            shareLabel={t("cta.share")}
            copiedLabel={t("cta.copied")}
            shareErrorLabel={t("cta.shareError")}
            showColorOptions={showColorOptions}
            showSizeOptions={showSizeOptions}
            colorOptions={explicitColorOptions}
            sizeOptions={explicitSizeOptions}
          />

          <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>{t("details.price")}</span>
              {hasDiscount ? (
                <span className="flex items-center gap-2 text-base font-semibold text-emerald-200">
                  {discountedLabel}
                  <span className="text-xs text-zinc-500 line-through">{priceLabel}</span>
                  <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                    -{product.discountPercent}%
                  </span>
                </span>
              ) : (
                <span className="text-base font-semibold text-emerald-200">{priceLabel}</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>{t("details.seller")}</span>
              <span>{product.seller?.displayName ?? t("details.sellerValue")}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>{t("details.stock")}</span>
              <span>
                {product.type === "LOCAL" && product.stockQuantity !== null
                  ? t("details.stockLocal", { count: product.stockQuantity ?? 0 })
                  : t("details.stockValue")}
              </span>
            </div>

            {attributeEntries.length > 0 && (
              <div className="grid gap-2 rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">
                  {locale === "fr" ? "Caracteristiques" : "Attributes"}
                </p>
                <div className="grid gap-1.5">
                  {attributeEntries.map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-zinc-400">{formatAttributeLabel(entry.key, locale)}</span>
                      <span className="max-w-[65%] text-right text-zinc-200">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span>{locale === "fr" ? "Avis vendeur" : "Seller rating"}</span>
              <span className="inline-flex items-center gap-1 text-emerald-200">
                <span className="tracking-[0.06em] text-amber-300">{getStars(sellerScore)}</span>
                <span>{sellerScore.toFixed(1)}</span>
                <span className="text-xs text-zinc-500">
                  (
                  {sellerRatingCount > 0
                    ? `${sellerRatingCount} ${locale === "fr" ? "avis" : "reviews"}`
                    : `${sellerSalesCount} ${locale === "fr" ? "ventes" : "sales"}`}
                  )
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>{locale === "fr" ? "Tendance" : "Demand"}</span>
              <span className="text-zinc-200">
                {locale === "fr"
                  ? `${recentSalesCount} ventes / 14j - ${favoritesCount} favoris`
                  : `${recentSalesCount} sales / 14d - ${favoritesCount} favorites`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>{locale === "fr" ? "Historique ventes" : "Sales history"}</span>
              <span className="text-zinc-200">
                {locale === "fr" ? `${totalSalesCount} ventes totales` : `${totalSalesCount} total sales`}
              </span>
            </div>
          </div>
        </section>

        <PurchaseInfoPanel
          locale={locale}
          productId={product.id}
          productType={product.type}
          preorderLeadDays={product.preorderLeadDays}
          deliveryOptions={product.deliveryOptions}
          pickupLocation={product.pickupLocation}
          sellerName={product.seller?.displayName ?? undefined}
          sellerRating={product.seller?.rating}
          sellerAvatarUrl={product.seller?.user?.image ?? null}
          sellerProductsCount={sellerProductsCount}
          sellerUserId={product.seller?.userId ?? undefined}
          sellerPhoneHref={sellerPhoneHref}
          sellerEmailHref={sellerEmailHref}
          sellerWhatsappHref={sellerWhatsappHref}
          buyHref="#purchase-actions"
          isAuthenticated={Boolean(session?.user)}
          isSellerOwner={Boolean(isSellerOwner)}
          openChatDefault={openChatDefault}
        />
      </main>
      <ProductReviewsPanel
        locale={locale}
        productId={product.id}
        isAuthenticated={Boolean(session?.user)}
        canReview={canReview}
        isSellerOwner={Boolean(isSellerOwner)}
        initialAverage={reviewAverage}
        initialCount={reviewCount}
        initialReviews={reviewItems}
      />

      {similarProducts.length > 0 && (
        <section className="mx-auto mb-10 w-full max-w-6xl px-6 fade-up">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold text-white">
              {locale === "fr" ? "Produits similaires" : "Similar products"}
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Vous aimerez aussi" : "You may also like"}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {similarProducts.map((item) => renderProductCard(item))}
          </div>
        </section>
      )}

      {bundleProducts.length > 0 && (
        <section className="mx-auto mb-16 w-full max-w-6xl px-6 fade-up">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold text-white">
              {locale === "fr" ? "A associer avec ce produit" : "Complete your purchase"}
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Suggestions complementaires" : "Complementary picks"}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {bundleProducts.map((item) => renderProductCard(item))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

