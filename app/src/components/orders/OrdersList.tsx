"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import AddToCartButton from "@/components/cart/AddToCartButton";
import type { ProductSuggestionItem } from "@/components/shop/ProductSuggestionGrid";

type RecommendedProduct = ProductSuggestionItem;

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
    product?: {
      title?: string | null;
      slug?: string | null;
      images?: { url: string }[] | null;
    } | null;
  }[];
};

type OrderGroup = {
  key: string;
  label: string;
  orders: Order[];
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

const INITIAL_VISIBLE_COUNT = 12;
const FETCH_TAKE = 50;

const confirmedStatuses = new Set(["CONFIRMED", "FULFILLING", "SHIPPED", "DELIVERED"]);
const pendingStatuses = new Set(["PENDING", "CANCELED", "REFUNDED"]);

function capitalizeLabel(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getStatusTone(status: string) {
  switch (status) {
    case "DELIVERED":
    case "CONFIRMED":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-200";
    case "FULFILLING":
    case "SHIPPED":
      return "border-sky-300/25 bg-sky-400/10 text-sky-200";
    case "PENDING":
      return "border-amber-300/25 bg-amber-400/10 text-amber-200";
    case "CANCELED":
    case "REFUNDED":
      return "border-rose-300/25 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-zinc-200";
  }
}

function buildOrderGroups(orders: Order[], locale: string, thisMonthLabel: string): OrderGroup[] {
  const now = new Date();
  const groups = new Map<string, OrderGroup>();
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  });

  for (const order of orders) {
    const date = new Date(order.createdAt);
    const isCurrentMonth =
      date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = isCurrentMonth
      ? thisMonthLabel
      : capitalizeLabel(monthFormatter.format(date));

    if (!groups.has(key)) {
      groups.set(key, { key, label, orders: [] });
    }

    groups.get(key)?.orders.push(order);
  }

  return Array.from(groups.values());
}

function RecommendationsRail({
  title,
  subtitle,
  products,
  locale,
  ctaLabel,
}: {
  title: string;
  subtitle: string;
  products: RecommendedProduct[];
  locale: string;
  ctaLabel: string;
}) {
  if (products.length === 0) return null;

  const isFr = locale === "fr";

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{title}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
        </div>
        <Link
          href="/shop"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-emerald-300/35 hover:bg-white/10"
        >
          {ctaLabel}
        </Link>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => {
          const discountedPrice =
            product.discountPercent && product.discountPercent > 0
              ? Math.round((product.priceCents * (100 - product.discountPercent)) / 100)
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
              className="min-w-[220px] max-w-[220px] rounded-2xl border border-white/10 bg-zinc-900/70 p-3"
            >
              <Link href={`/shop/${product.slug}`} className="block">
                <div className="h-24 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt ?? product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                      Image
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-white">{product.title}</p>
                  {isSoldOut ? (
                    <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                      {isFr ? "Epuise" : "Sold out"}
                    </span>
                  ) : isLowStock ? (
                    <span className="shrink-0 rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200">
                      {isFr ? "Stock faible" : "Low stock"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {product.seller?.displayName ?? "-"}
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-200">
                  {formatMoney(discountedPrice, product.currency, locale)}
                </p>
              </Link>

              {isSoldOut ? (
                <p className="mt-2 text-[11px] text-amber-100/80">
                  {isFr ? "Momentanement indisponible." : "Temporarily unavailable."}
                </p>
              ) : isLowStock ? (
                <p className="mt-2 text-[11px] text-orange-100/80">
                  {isFr ? `Plus que ${localStock} en stock.` : `Only ${localStock} left.`}
                </p>
              ) : null}

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
                  label={isFr ? "Ajouter" : "Add"}
                  addedLabel={isFr ? "Ajoute" : "Added"}
                  soldOutLabel={isFr ? "Epuise" : "Sold out"}
                  checkingLabel={isFr ? "Verification..." : "Checking..."}
                  disabled={isSoldOut}
                  className="inline-flex rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-zinc-950 transition hover:bg-emerald-300"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const recommendationSourceIds = useMemo(
    () =>
      Array.from(
        new Set(
          orders.flatMap((order) => order.items.map((item) => item.productId).filter(Boolean))
        )
      ).slice(0, 18),
    [orders]
  );

  const summary = useMemo(() => {
    const currency = orders[0]?.currency ?? "XOF";
    return {
      total: orders.length,
      confirmed: orders.filter((order) => confirmedStatuses.has(order.status)).length,
      pending: orders.filter((order) => pendingStatuses.has(order.status)).length,
      spent: orders.reduce((sum, order) => sum + order.totalCents, 0),
      currency,
    };
  }, [orders]);

  const visibleOrders = useMemo(
    () => orders.slice(0, Math.min(visibleCount, orders.length)),
    [orders, visibleCount]
  );

  const groupedOrders = useMemo(
    () => buildOrderGroups(visibleOrders, locale, t("groups.thisMonth")),
    [visibleOrders, locale, t]
  );

  const recommendationProducts = useMemo(
    () =>
      [...similarProducts, ...complementaryProducts].filter(
        (product, index, current) =>
          current.findIndex((entry) => entry.id === product.id) === index
      ).slice(0, 10),
    [similarProducts, complementaryProducts]
  );

  const denseMode = orders.length > 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("take", String(FETCH_TAKE));
      if (statusFilter) params.set("status", statusFilter);
      if (rangeFilter && rangeFilter !== "all") params.set("range", rangeFilter);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.generic"));
      }
      const data = (await res.json()) as Order[];
      setOrders(data);
      setVisibleCount(INITIAL_VISIBLE_COUNT);
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
          take: "8",
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
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("subtitleDashboard")}</p>
          </div>
          {orders.length > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
              {t("summary.visible", {
                current: Math.min(visibleCount, orders.length),
                total: orders.length,
              })}
            </span>
          ) : null}
        </div>
      </section>

      {orders.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t("summary.total")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t("summary.confirmed")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">{summary.confirmed}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t("summary.pending")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-200">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t("summary.spent")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatMoney(summary.spent, summary.currency, locale)}
            </p>
          </div>
        </section>
      ) : null}

      <section className="sticky top-4 z-20 rounded-2xl border border-white/10 bg-zinc-950/80 p-3 backdrop-blur-xl">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-2.5 text-xs text-white"
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
            className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-2.5 text-xs text-white"
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
            onClick={() => {
              void load();
            }}
            className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-semibold text-zinc-950"
          >
            {t("filters.apply")}
          </button>
        </div>
      </section>

      {orders.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <p className="text-sm text-zinc-400">{t("empty")}</p>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {t("list.title")}
              </p>
              <p className="mt-1 text-sm text-zinc-300">{t("list.subtitle")}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
              {t("summary.visible", {
                current: Math.min(visibleCount, orders.length),
                total: orders.length,
              })}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            {groupedOrders.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                    {group.label}
                  </p>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  {group.orders.map((order) => {
                    const previewImage = order.items[0]?.product?.images?.[0]?.url;
                    const firstProductTitle = order.items[0]?.product?.title?.trim();
                    const additionalItemsCount = Math.max(0, order.items.length - 1);
                    const leadProductTitle = firstProductTitle
                      ? additionalItemsCount > 0
                        ? locale === "fr"
                          ? `${firstProductTitle} + ${additionalItemsCount} autre${
                              additionalItemsCount > 1 ? "s" : ""
                            }`
                          : `${firstProductTitle} + ${additionalItemsCount} more`
                        : firstProductTitle
                      : `#${order.id.slice(0, 10)}`;
                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className={`group rounded-2xl border border-white/10 bg-zinc-950/60 ${
                          denseMode ? "p-4" : "p-5"
                        } transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-zinc-950/85 hover:shadow-[0_18px_40px_-24px_rgba(16,185,129,0.55)]`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/70">
                            {previewImage ? (
                              <img src={previewImage} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                                Image
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="text-sm font-semibold text-white">
                                {leadProductTitle}
                              </p>
                              <span className="text-[11px] text-zinc-500">
                                {new Date(order.createdAt).toLocaleDateString(locale, {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                              <span>#{order.id.slice(0, 10)}</span>
                              <span className="text-[11px] text-zinc-500">
                                {t("labels.items", { count: order.items.length })}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getStatusTone(
                                  order.status
                                )}`}
                              >
                                {t(`status.${statusMap[order.status] ?? "pending"}`)}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-white">
                              {formatMoney(order.totalCents, order.currency, locale)}
                            </p>
                            <span className="mt-2 inline-block text-[11px] font-medium text-emerald-200/80 transition-colors duration-200 group-hover:text-emerald-100">
                              {locale === "fr" ? "Ouvrir" : "Open"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <RecommendationsRail
        title={t("recommendations.title")}
        subtitle={t("recommendations.subtitle")}
        products={recommendationProducts}
        locale={locale}
        ctaLabel={t("recommendations.explore")}
      />
    </div>
  );
}
