"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import AddToCartButton from "@/components/cart/AddToCartButton";

type Favorite = {
  id: string;
  productId: string;
  product: {
    id: string;
    title: string;
    priceCents: number;
    discountPercent?: number | null;
    currency: string;
    slug: string;
    type: "PREORDER" | "DROPSHIP" | "LOCAL";
    stockQuantity?: number | null;
    images: { url: string; alt?: string | null }[];
    seller?: { displayName?: string | null } | null;
  };
};

type SuggestedProduct = {
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

type RecommendationsResponse = {
  similar?: SuggestedProduct[];
  complementary?: SuggestedProduct[];
};

export default function FavoritesList() {
  const t = useTranslations("Favorites");
  const cartT = useTranslations("Cart");
  const locale = useLocale();
  const isFr = locale === "fr";
  const [items, setItems] = useState<Favorite[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sourceProductIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.product.id))).slice(0, 12),
    [items]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Favorite[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    const loadSuggestions = async () => {
      if (sourceProductIds.length === 0) {
        setSuggestedProducts([]);
        return;
      }

      setSuggestionsLoading(true);

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
            setSuggestedProducts([]);
          }
          return;
        }

        const payload = (await response.json()) as RecommendationsResponse;
        if (cancelled) return;

        const similar = Array.isArray(payload.similar) ? payload.similar : [];
        const complementary = Array.isArray(payload.complementary)
          ? payload.complementary
          : [];

        const merged = [...similar, ...complementary]
          .filter(
            (product, index, current) =>
              !sourceProductIds.includes(product.id) &&
              current.findIndex((entry) => entry.id === product.id) === index
          )
          .slice(0, 6);

        setSuggestedProducts(merged);
      } catch {
        if (!cancelled) {
          setSuggestedProducts([]);
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [sourceProductIds]);

  const remove = async (productId: string) => {
    await fetch(`/api/favorites?productId=${productId}`, { method: "DELETE" });
    load();
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-rose-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>

        {items.length === 0 && (
          <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>
        )}

        {items.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((fav) => {
            const discountedPrice = fav.product.discountPercent
              ? getDiscountedPrice(
                  fav.product.priceCents,
                  fav.product.discountPercent
                )
              : fav.product.priceCents;
            const localStock =
              fav.product.type === "LOCAL"
                ? Math.max(0, Math.floor(Number(fav.product.stockQuantity ?? 0)))
                : undefined;
            const maxQuantity =
              fav.product.type === "LOCAL" && (localStock ?? 0) > 0
                ? localStock
                : undefined;
            const isSoldOut = fav.product.type === "LOCAL" && (localStock ?? 0) <= 0;
            const isLowStock =
              fav.product.type === "LOCAL" && (localStock ?? 0) > 0 && (localStock ?? 0) <= 3;

              return (
                <div
                  key={fav.id}
                  className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
                >
                  <Link href={`/shop/${fav.product.slug}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900">
                      {fav.product.images?.[0]?.url ? (
                        <img
                          src={fav.product.images[0].url}
                          alt={fav.product.images[0].alt ?? fav.product.title}
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        />
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">
                        {fav.product.title}
                      </h3>
                      {isSoldOut ? (
                        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                          {cartT("favoritesBox.soldOut")}
                        </span>
                      ) : isLowStock ? (
                        <span className="shrink-0 rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200">
                          {t("lowStockBadge")}
                        </span>
                      ) : null}
                    </div>
                  </Link>

                  <p className="mt-1 text-xs text-zinc-400">
                    {fav.product.seller?.displayName ?? t("unknownSeller")}
                  </p>
                  <p className="mt-2 text-sm text-emerald-200">
                    {formatMoney(discountedPrice, fav.product.currency, locale)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <AddToCartButton
                      id={fav.product.id}
                      slug={fav.product.slug}
                      title={fav.product.title}
                      priceCents={discountedPrice}
                      currency={fav.product.currency}
                      type={fav.product.type}
                      sellerName={fav.product.seller?.displayName ?? undefined}
                      maxQuantity={maxQuantity}
                      label={cartT("favoritesBox.addToCart")}
                      addedLabel={isFr ? "Ajoute" : "Added"}
                      soldOutLabel={cartT("favoritesBox.soldOut")}
                      checkingLabel={isFr ? "Verification..." : "Checking..."}
                      disabled={isSoldOut}
                      className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 transition hover:bg-emerald-300"
                    />
                    <button
                      type="button"
                      onClick={() => remove(fav.productId)}
                      className="rounded-full border border-white/20 px-4 py-2 text-[11px] text-white transition hover:border-white/40"
                    >
                      {t("remove")}
                    </button>
                  </div>

                  {isSoldOut ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-amber-100/80">
                      {t("soldOutHint")}
                    </p>
                  ) : isLowStock ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-orange-100/80">
                      {t("lowStockHint", { count: localStock ?? 0 })}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (suggestionsLoading || suggestedProducts.length > 0) ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {t("suggestionsTitle")}
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                {t("suggestionsSubtitle")}
              </p>
            </div>
          </div>

          {suggestionsLoading ? (
            <p className="mt-6 text-sm text-zinc-400">{t("loading")}</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestedProducts.map((product) => {
                const discountedPrice =
                  product.discountPercent && product.discountPercent > 0
                    ? getDiscountedPrice(
                        product.priceCents,
                        product.discountPercent
                      )
                    : product.priceCents;
                const localStock =
                  product.type === "LOCAL"
                    ? Math.max(0, Math.floor(Number(product.stockQuantity ?? 0)))
                    : undefined;
                const maxQuantity =
                  product.type === "LOCAL" && (localStock ?? 0) > 0 ? localStock : undefined;
                const isSoldOut = product.type === "LOCAL" && (localStock ?? 0) <= 0;
                const isLowStock =
                  product.type === "LOCAL" && (localStock ?? 0) > 0 && (localStock ?? 0) <= 3;

                return (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
                  >
                    <Link href={`/shop/${product.slug}`} className="group block">
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.images[0].alt ?? product.title}
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                          />
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <h3 className="line-clamp-2 text-sm font-semibold text-white">
                          {product.title}
                        </h3>
                        {isSoldOut ? (
                          <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                            {cartT("favoritesBox.soldOut")}
                          </span>
                        ) : isLowStock ? (
                          <span className="shrink-0 rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200">
                            {t("lowStockBadge")}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                    <p className="mt-1 text-xs text-zinc-400">
                      {product.seller?.displayName ?? t("unknownSeller")}
                    </p>
                    <p className="mt-2 text-sm text-emerald-200">
                      {formatMoney(discountedPrice, product.currency, locale)}
                    </p>
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
                        label={cartT("favoritesBox.addToCart")}
                        addedLabel={isFr ? "Ajoute" : "Added"}
                        soldOutLabel={cartT("favoritesBox.soldOut")}
                        checkingLabel={isFr ? "Verification..." : "Checking..."}
                        disabled={isSoldOut}
                        className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 transition hover:bg-emerald-300"
                      />
                    </div>
                    {isSoldOut ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-amber-100/80">
                        {t("soldOutHint")}
                      </p>
                    ) : isLowStock ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-orange-100/80">
                        {t("lowStockHint", { count: localStock ?? 0 })}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
