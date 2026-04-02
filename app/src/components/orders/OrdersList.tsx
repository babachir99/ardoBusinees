"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import FavoriteButton from "@/components/favorites/FavoriteButton";

type RecommendedProduct = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  discountPercent?: number | null;
  currency: string;
  seller?: { displayName: string; slug: string } | null;
  images: { url: string }[];
};

type RecommendationsResponse = {
  similar?: RecommendedProduct[];
  complementary?: RecommendedProduct[];
};

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    product?: { images?: { url: string }[] | null } | null;
  }[];
};

const statusMap: Record<string, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  FULFILLING: "fulfilling",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELED: "canceled",
  REFUNDED: "refunded",
};

function RecommendedGrid({
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

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 first:mt-8">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const discountedPrice =
            product.discountPercent && product.discountPercent > 0
              ? Math.round((product.priceCents * (100 - product.discountPercent)) / 100)
              : product.priceCents;

          return (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              className="group rounded-2xl border border-white/10 bg-zinc-900/70 p-3 transition hover:border-emerald-300/60"
            >
              <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
                <FavoriteButton
                  productId={product.id}
                  variant="icon"
                  className="absolute left-2 top-2 z-20"
                />
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
              </div>
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
          );
        })}
      </div>
    </div>
  );
}

export default function OrdersList() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [similarProducts, setSimilarProducts] = useState<RecommendedProduct[]>([]);
  const [complementaryProducts, setComplementaryProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("all");

  const recommendationSourceIds = useMemo(
    () =>
      Array.from(
        new Set(
          orders.flatMap((order) => order.items.map((item) => item.productId).filter(Boolean))
        )
      ).slice(0, 18),
    [orders]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("take", "30");
      if (statusFilter) params.set("status", statusFilter);
      if (rangeFilter && rangeFilter !== "all") params.set("range", rangeFilter);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.generic"));
      }
      const data = (await res.json()) as Order[];
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [rangeFilter, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    const loadRecommendations = async () => {
      if (recommendationSourceIds.length === 0) {
        if (!cancelled) {
          setSimilarProducts([]);
          setComplementaryProducts([]);
        }
        return;
      }

      try {
        const params = new URLSearchParams({
          productIds: recommendationSourceIds.join(","),
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

        const payload = (await response.json()) as RecommendationsResponse | RecommendedProduct[];

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
  }, [recommendationSourceIds]);

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
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300 sm:grid-cols-3">
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("filters.allStatus")}</option>
          {Object.keys(statusMap).map((status) => (
            <option key={status} value={status}>
              {t(`status.${statusMap[status]}`)}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={rangeFilter}
          onChange={(e) => setRangeFilter(e.target.value)}
        >
          <option value="all">{t("filters.rangeAll")}</option>
          <option value="7">{t("filters.range7")}</option>
          <option value="30">{t("filters.range30")}</option>
          <option value="90">{t("filters.range90")}</option>
          <option value="365">{t("filters.range365")}</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("filters.apply")}
        </button>
      </div>

      {orders.length === 0 && <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>}

      {orders.length > 0 && (
        <div className="mt-6 grid gap-4">
          {orders.map((order) => {
            const previewImage = order.items[0]?.product?.images?.[0]?.url;

            return (
              <div key={order.id} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
                    {previewImage ? (
                      <img src={previewImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                        Image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-zinc-400">{t("labels.order")}</p>
                        <p className="text-sm font-semibold text-white">{order.id.slice(0, 10)}...</p>
                      </div>
                      <p className="text-xs text-emerald-300">
                        {t(`status.${statusMap[order.status] ?? "pending"}`)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-zinc-300">
                      <span>{t("labels.items", { count: order.items.length })}</span>
                      <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                      <span>{new Date(order.createdAt).toLocaleDateString(locale)}</span>
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex whitespace-nowrap rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 transition hover:border-emerald-200 hover:bg-emerald-400/20"
                      >
                        {t("labels.view")}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecommendedGrid
        title={t("detail.recommendedSimilarTitle")}
        subtitle={t("detail.recommendedSimilarSubtitle")}
        products={similarProducts}
        locale={locale}
      />

      <RecommendedGrid
        title={t("detail.recommendedComplementaryTitle")}
        subtitle={t("detail.recommendedComplementarySubtitle")}
        products={complementaryProducts}
        locale={locale}
      />
    </div>
  );
}