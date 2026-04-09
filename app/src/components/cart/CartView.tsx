"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import AddToCartButton from "@/components/cart/AddToCartButton";

type RecommendedProduct = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  discountPercent?: number | null;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  stockQuantity?: number | null;
  seller?: { displayName: string; slug: string } | null;
  images: { url: string }[];
};

type RecommendationsResponse = {
  similar?: RecommendedProduct[];
  complementary?: RecommendedProduct[];
};

type FavoriteItem = {
  id: string;
  productId: string;
  product: {
    id: string;
    title: string;
    slug: string;
    priceCents: number;
    discountPercent?: number | null;
    currency: string;
    type: "PREORDER" | "DROPSHIP" | "LOCAL";
    stockQuantity?: number | null;
    seller?: { displayName?: string | null } | null;
    images: { url: string; alt?: string | null }[];
  };
};

function ProductSuggestionGrid({
  title,
  subtitle,
  products,
  locale,
}: {
  title: string;
  subtitle: string;
  products: RecommendedProduct[];
  locale: string;
}) {
  if (products.length === 0) return null;
  const isFr = locale === "fr";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const discountedPrice =
            product.discountPercent && product.discountPercent > 0
              ? Math.round((product.priceCents * (100 - product.discountPercent)) / 100)
              : product.priceCents;
          const maxQuantity =
            product.type === "LOCAL" && Number(product.stockQuantity ?? 0) > 0
              ? Math.floor(Number(product.stockQuantity))
              : undefined;

          return (
            <div
              key={product.id}
              className="group rounded-2xl border border-white/10 bg-zinc-900/70 p-3 transition hover:border-emerald-300/60"
            >
              <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
                <FavoriteButton
                  productId={product.id}
                  variant="icon"
                  className="absolute left-2 top-2 z-20"
                />
                <Link href={`/shop/${product.slug}`} className="block h-full">
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                      Image
                    </div>
                  )}
                </Link>
              </div>
              <Link href={`/shop/${product.slug}`} className="block">
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">{product.title}</p>
                <p className="mt-1 text-[11px] text-zinc-400">{product.seller?.displayName ?? "-"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatMoney(discountedPrice, product.currency, locale)}
                  </span>
                  {product.discountPercent && product.discountPercent > 0 && (
                    <span className="text-[11px] text-zinc-500 line-through">
                      {formatMoney(product.priceCents, product.currency, locale)}
                    </span>
                  )}
                </div>
              </Link>
              <div className="mt-3">
                <AddToCartButton
                  id={product.id}
                  slug={product.slug}
                  title={product.title}
                  priceCents={discountedPrice}
                  currency={product.currency}
                  type={product.type}
                  sellerName={product.seller?.displayName ?? undefined}
                  maxQuantity={maxQuantity}
                  label={isFr ? "Ajouter au panier" : "Add to cart"}
                  addedLabel={isFr ? "Ajoute" : "Added"}
                  soldOutLabel={isFr ? "Epuise" : "Sold out"}
                  checkingLabel={isFr ? "Verification..." : "Checking..."}
                  className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CartView() {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const { items, updateQuantity, removeItem, clear, subtotalCents } = useCart();
  const isFr = locale === "fr";

  const [similarProducts, setSimilarProducts] = useState<RecommendedProduct[]>([]);
  const [complementaryProducts, setComplementaryProducts] = useState<RecommendedProduct[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  const sourceProductIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.id))).slice(0, 18),
    [items]
  );

  useEffect(() => {
    let cancelled = false;

    const loadRecommendations = async () => {
      if (sourceProductIds.length === 0) {
        if (!cancelled) {
          setSimilarProducts([]);
          setComplementaryProducts([]);
        }
        return;
      }

      try {
        const params = new URLSearchParams({
          productIds: sourceProductIds.join(","),
          take: "6",
        });
        const response = await fetch(`/api/products/recommendations?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setSimilarProducts([]);
            setComplementaryProducts([]);
          }
          return;
        }

        const payload = (await response.json()) as
          | RecommendationsResponse
          | RecommendedProduct[];

        if (!cancelled) {
          if (Array.isArray(payload)) {
            setSimilarProducts(payload);
            setComplementaryProducts([]);
          } else {
            setSimilarProducts(Array.isArray(payload.similar) ? payload.similar : []);
            setComplementaryProducts(
              Array.isArray(payload.complementary) ? payload.complementary : []
            );
          }
        }
      } catch {
        if (!cancelled) {
          setSimilarProducts([]);
          setComplementaryProducts([]);
        }
      }
    };

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [sourceProductIds]);

  useEffect(() => {
    let cancelled = false;

    const loadFavorites = async () => {
      setFavoritesLoading(true);
      try {
        const response = await fetch("/api/favorites", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setFavorites([]);
          }
          return;
        }

        const payload = (await response.json()) as FavoriteItem[];
        if (!cancelled) {
          setFavorites(Array.isArray(payload) ? payload.slice(0, 6) : []);
        }
      } catch {
        if (!cancelled) {
          setFavorites([]);
        }
      } finally {
        if (!cancelled) {
          setFavoritesLoading(false);
        }
      }
    };

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  const removeFavorite = async (productId: string) => {
    try {
      const response = await fetch(`/api/favorites?productId=${productId}`, {
        method: "DELETE",
      });

      if (response.ok || response.status === 404) {
        setFavorites((current) => current.filter((item) => item.productId !== productId));
      }
    } catch {
      // no-op
    }
  };

  const feesCents = Math.round(subtotalCents * 0.04);
  const totalCents = subtotalCents + feesCents;

  if (items.length === 0) {
    return (
      <div className="grid gap-6">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-10 text-center">
          <h1 className="text-2xl font-semibold">{t("emptyTitle")}</h1>
          <p className="mt-3 text-sm text-zinc-300">{t("emptyDesc")}</p>
          <Link
            href="/shop"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {t("continue")}
          </Link>
        </div>

        {!favoritesLoading && favorites.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-300">{t("favoritesBox.title")}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{t("favoritesBox.subtitle")}</p>
              </div>
              <Link
                href="/favorites"
                className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-[11px] text-zinc-200 transition hover:border-white/40"
              >
                {t("favoritesBox.viewAll")}
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {favorites.map((favorite) => {
                const product = favorite.product;
                const discountedPrice =
                  product.discountPercent && product.discountPercent > 0
                    ? Math.round((product.priceCents * (100 - product.discountPercent)) / 100)
                    : product.priceCents;
                const isSoldOut =
                  product.type === "LOCAL" && Number(product.stockQuantity ?? 0) <= 0;

                return (
                  <div
                    key={favorite.id}
                    className="rounded-xl border border-white/10 bg-zinc-950/60 p-3"
                  >
                    <Link href={`/shop/${product.slug}`} className="group block">
                      <div className="h-24 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.images[0].alt ?? product.title}
                            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                            Image
                          </div>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                        {product.title}
                      </p>
                    </Link>

                    <p className="mt-1 text-[11px] text-zinc-400">
                      {product.seller?.displayName ?? "-"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-200">
                      {formatMoney(discountedPrice, product.currency, locale)}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <AddToCartButton
                        id={product.id}
                        slug={product.slug}
                        title={product.title}
                        priceCents={discountedPrice}
                        currency={product.currency}
                        type={product.type}
                        sellerName={product.seller?.displayName ?? undefined}
                        maxQuantity={
                          product.type === "LOCAL" && Number(product.stockQuantity ?? 0) > 0
                            ? Math.floor(Number(product.stockQuantity))
                            : undefined
                        }
                        label={t("favoritesBox.addToCart")}
                        addedLabel={isFr ? "Ajoute" : "Added"}
                        soldOutLabel={t("favoritesBox.soldOut")}
                        checkingLabel={isFr ? "Verification..." : "Checking..."}
                        className="inline-flex rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-zinc-950 transition hover:bg-emerald-300"
                        disabled={isSoldOut}
                      />
                      <button
                        type="button"
                        onClick={() => removeFavorite(favorite.productId)}
                        title={t("favoritesBox.remove")}
                        aria-label={t("favoritesBox.remove")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-sm text-zinc-200 transition hover:border-white/40"
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-zinc-400 underline decoration-white/20"
          >
            {t("clear")}
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {items.map((item) => {
            const reachedMax = Boolean(item.maxQuantity && item.quantity >= item.maxQuantity);

            return (
              <div
                key={item.lineId}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {item.type === "PREORDER"
                      ? t("labels.preorder")
                      : item.type === "LOCAL"
                      ? isFr
                        ? "Local"
                        : "Local"
                      : t("labels.dropship")}
                  </p>
                  {(item.optionColor || item.optionSize || item.maxQuantity) && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.optionColor
                        ? `${isFr ? "Couleur" : "Color"}: ${item.optionColor}`
                        : ""}
                      {item.optionColor && item.optionSize ? " - " : ""}
                      {item.optionSize ? `${isFr ? "Taille" : "Size"}: ${item.optionSize}` : ""}
                      {item.maxQuantity
                        ? `${item.optionColor || item.optionSize ? " - " : ""}${
                            isFr ? "Stock max" : "Max stock"
                          }: ${item.maxQuantity}`
                        : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                    className="rounded-full border border-white/15 px-3 py-1"
                  >
                    -
                  </button>
                  <span className="min-w-[24px] text-center">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                    disabled={reachedMax}
                    className="rounded-full border border-white/15 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatMoney(item.priceCents, item.currency, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.lineId)}
                    className="text-xs text-zinc-400 underline decoration-white/20"
                  >
                    {t("removeLine")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4">
          <ProductSuggestionGrid
            title={t("recommendedSimilarTitle")}
            subtitle={t("recommendedSimilarSubtitle")}
            products={similarProducts}
            locale={locale}
          />
          <ProductSuggestionGrid
            title={t("recommendedComplementaryTitle")}
            subtitle={t("recommendedComplementarySubtitle")}
            products={complementaryProducts}
            locale={locale}
          />

          {!favoritesLoading && favorites.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-300">
                    {t("favoritesBox.title")}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {t("favoritesBox.subtitle")}
                  </p>
                </div>
                <Link
                  href="/favorites"
                  className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-[11px] text-zinc-200 transition hover:border-white/40"
                >
                  {t("favoritesBox.viewAll")}
                </Link>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {favorites.map((favorite) => {
                  const product = favorite.product;
                  const discountedPrice =
                    product.discountPercent && product.discountPercent > 0
                      ? Math.round((product.priceCents * (100 - product.discountPercent)) / 100)
                      : product.priceCents;
                  const isSoldOut =
                    product.type === "LOCAL" && Number(product.stockQuantity ?? 0) <= 0;

                  return (
                    <div
                      key={favorite.id}
                      className="rounded-xl border border-white/10 bg-zinc-900/60 p-3"
                    >
                      <Link href={`/shop/${product.slug}`} className="group block">
                        <div className="h-24 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
                          {product.images?.[0]?.url ? (
                            <img
                              src={product.images[0].url}
                              alt={product.images[0].alt ?? product.title}
                              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                              Image
                            </div>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                          {product.title}
                        </p>
                      </Link>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {product.seller?.displayName ?? "-"}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm font-semibold text-emerald-200">
                          {formatMoney(discountedPrice, product.currency, locale)}
                        </span>
                        {product.discountPercent && product.discountPercent > 0 && (
                          <span className="text-[11px] text-zinc-500 line-through">
                            {formatMoney(product.priceCents, product.currency, locale)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2">
                        <AddToCartButton
                          id={product.id}
                          slug={product.slug}
                          title={product.title}
                          priceCents={discountedPrice}
                          currency={product.currency}
                          type={product.type}
                          sellerName={product.seller?.displayName ?? undefined}
                          maxQuantity={
                            product.type === "LOCAL" && Number(product.stockQuantity ?? 0) > 0
                              ? Math.floor(Number(product.stockQuantity))
                              : undefined
                          }
                          label={t("favoritesBox.addToCart")}
                          addedLabel={isFr ? "Ajoute" : "Added"}
                          soldOutLabel={t("favoritesBox.soldOut")}
                          checkingLabel={isFr ? "Verification..." : "Checking..."}
                          className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-300"
                          disabled={isSoldOut}
                        />
                        <button
                          type="button"
                          onClick={() => removeFavorite(favorite.productId)}
                          className="rounded-full border border-white/20 px-3 py-2 text-xs text-zinc-200 transition hover:border-white/40"
                        >
                          {t("favoritesBox.remove")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8">
        <h2 className="text-xl font-semibold">{t("summary.title")}</h2>
        <div className="mt-5 grid gap-3 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span>{t("summary.subtotal")}</span>
            <span>{formatMoney(subtotalCents, "XOF", locale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("summary.fees")}</span>
            <span>{formatMoney(feesCents, "XOF", locale)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-white">
            <span>{t("summary.total")}</span>
            <span>{formatMoney(totalCents, "XOF", locale)}</span>
          </div>
        </div>
        <Link
          href="/checkout"
          className="mt-6 block rounded-full bg-emerald-400 px-6 py-3 text-center text-sm font-semibold text-zinc-950"
        >
          {t("summary.cta")}
        </Link>
      </aside>
    </div>
  );
}





