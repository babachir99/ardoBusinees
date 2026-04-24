"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import AddToCartButton from "@/components/cart/AddToCartButton";
import InlineReviewForm from "@/components/orders/InlineReviewForm";
import type { ProductSuggestionItem } from "@/components/shop/ProductSuggestionGrid";

type OrderEvent = {
  id: string;
  status: string;
  note?: string | null;
  proofUrl?: string | null;
  createdAt: string;
};

type OrderMessage = {
  id: string;
  body: string;
  senderRole?: string | null;
  sender?: { name?: string | null; email?: string | null } | null;
  createdAt: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  optionColor?: string | null;
  optionSize?: string | null;
  product?: {
    id: string;
    title: string;
    slug: string;
    images?: { url: string }[];
  } | null;
};

type RecommendedProduct = ProductSuggestionItem;

type RecommendationsResponse = {
  similar?: RecommendedProduct[];
  complementary?: RecommendedProduct[];
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  seller?: {
    id: string;
    displayName: string;
    slug: string;
    rating?: number | null;
    user?: { image?: string | null; name?: string | null } | null;
  } | null;
  sellerStats?: {
    activeProducts: number;
    paidOrders: number;
    ratingAverage: number;
    ratingCount: number;
  } | null;
  recommendedProducts?: RecommendedProduct[];
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  messages: OrderMessage[];
};

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

function getPaymentTone(status: string) {
  switch (status) {
    case "PAID":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-200";
    case "PENDING":
      return "border-amber-300/25 bg-amber-400/10 text-amber-200";
    case "FAILED":
    case "REFUNDED":
      return "border-rose-300/25 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-zinc-200";
  }
}

function CompactRecommendationRail({
  title,
  subtitle,
  products,
  locale,
  className = "rounded-2xl border border-white/10 bg-zinc-950/50 p-4 md:p-5",
}: {
  title: string;
  subtitle: string;
  products: RecommendedProduct[];
  locale: string;
  className?: string;
}) {
  if (products.length === 0) return null;

  const isFr = locale === "fr";

  return (
    <section className={className}>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
        <p className="mt-1 text-sm text-zinc-300">{subtitle}</p>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
              className="group min-w-[236px] max-w-[236px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,31,39,0.96),rgba(14,17,22,0.94))] p-3.5 transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_22px_50px_-36px_rgba(16,185,129,0.55)]"
            >
              <Link href={`/shop/${product.slug}`} className="block">
                <div className="h-28 overflow-hidden rounded-[18px] border border-white/10 bg-zinc-950/80">
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt ?? product.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                      Image
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-white">{product.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {product.seller?.displayName ?? "-"}
                    </p>
                  </div>
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
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      {isFr ? "Prix" : "Price"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-200">
                      {formatMoney(discountedPrice, product.currency, locale)}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400">
                    {isFr ? "Suggestion" : "Suggested"}
                  </span>
                </div>
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

export default function OrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [similarProducts, setSimilarProducts] = useState<RecommendedProduct[]>([]);
  const [complementaryProducts, setComplementaryProducts] = useState<RecommendedProduct[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ productId: string; title: string } | null>(null);

  const sourceProductIds = useMemo(() => {
    if (!order) return [] as string[];
    return Array.from(
      new Set(order.items.map((item) => item.product?.id).filter((id): id is string => Boolean(id)))
    ).slice(0, 18);
  }, [order]);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.generic"));
      }
      const data = (await res.json()) as Order;
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

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
  }, [sourceProductIds]);

  const sendMessage = async () => {
    if (!order) return;
    const message = messageDraft.trim();
    if (!message) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.generic"));
      }
      setMessageDraft("");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("empty")}</p>
      </div>
    );
  }

  const canReviewOrder = order.paymentStatus === "PAID" || order.status === "DELIVERED";
  const sellerIdentity =
    order.seller?.displayName || order.seller?.user?.name || t("detail.unknownSeller");
  const sellerInitial = sellerIdentity.slice(0, 1).toUpperCase();
  const sellerRatingValue = order.sellerStats?.ratingAverage ?? order.seller?.rating ?? 0;
  const sellerRatingCount = order.sellerStats?.ratingCount ?? 0;
  const firstProductTitle = order.items[0]?.product?.title?.trim();
  const additionalItemsCount = Math.max(0, order.items.length - 1);
  const leadOrderTitle = firstProductTitle
    ? additionalItemsCount > 0
      ? locale === "fr"
        ? `${firstProductTitle} + ${additionalItemsCount} autre${
            additionalItemsCount > 1 ? "s" : ""
          }`
        : `${firstProductTitle} + ${additionalItemsCount} more`
      : firstProductTitle
    : t("detail.title");
  const isFr = locale === "fr";
  const orderDateLabel = new Date(order.createdAt).toLocaleString(locale);
  const timelineEvents = [...order.events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const recommendedProducts = [
    ...(order.recommendedProducts ?? []),
    ...complementaryProducts,
    ...similarProducts,
  ]
    .filter((product, index, current) => current.findIndex((entry) => entry.id === product.id) === index)
    .slice(0, 8);
  const currentStageIndex = (() => {
    switch (order.status) {
      case "FULFILLING":
        return 1;
      case "SHIPPED":
        return 2;
      case "DELIVERED":
      case "REFUNDED":
        return 3;
      case "PENDING":
      case "CONFIRMED":
      case "CANCELED":
      default:
        return 0;
    }
  })();
  const stageKeys = ["CONFIRMED", "FULFILLING", "SHIPPED", "DELIVERED"] as const;
  const stageDescriptions = isFr
    ? {
        CONFIRMED: "Paiement confirme et commande enregistree.",
        FULFILLING: "Le vendeur prepare les articles.",
        SHIPPED: "Le colis est en cours d'acheminement.",
        DELIVERED: "La commande a ete livree avec succes.",
      }
    : {
        CONFIRMED: "Payment confirmed and order registered.",
        FULFILLING: "The seller is preparing your items.",
        SHIPPED: "The parcel is on its way.",
        DELIVERED: "The order has been delivered successfully.",
      };
  const stageDateMap = new Map<string, string>();
  stageDateMap.set("CONFIRMED", order.createdAt);
  for (const event of timelineEvents) {
    if (!stageDateMap.has(event.status)) {
      stageDateMap.set(event.status, event.createdAt);
    }
  }
  const stageTimeline = stageKeys.map((statusKey, index) => ({
    statusKey,
    label: t(`status.${statusKey.toLowerCase()}`),
    description: stageDescriptions[statusKey],
    date: stageDateMap.get(statusKey) ?? null,
    state:
      index < currentStageIndex ? "done" : index == currentStageIndex ? "current" : "upcoming",
  }));
  const hasScrollableItems = order.items.length > 2;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,20,28,0.96),rgba(16,35,32,0.76),rgba(10,14,18,0.96))] p-6 shadow-[0_36px_90px_-48px_rgba(16,185,129,0.45)] md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{t("detail.title")}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[2rem]">
              {leadOrderTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              <span>{orderDateLabel}</span>
              <span className="text-zinc-600">-</span>
              <span>{sellerIdentity}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                #{order.id.slice(0, 10)}
              </span>
              <span
                className={`rounded-full border px-3 py-1.5 font-medium uppercase tracking-[0.18em] ${getStatusTone(
                  order.status
                )}`}
              >
                {t(`status.${order.status.toLowerCase()}`)}
              </span>
              <span
                className={`rounded-full border px-3 py-1.5 font-medium uppercase tracking-[0.18em] ${getPaymentTone(
                  order.paymentStatus
                )}`}
              >
                {t(`payment.${order.paymentStatus.toLowerCase()}`)}
              </span>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href="/orders"
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10"
            >
              {t("detail.back")}
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadOrder();
              }}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10"
            >
              {t("detail.refresh")}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm md:p-5">
          <div className="grid gap-4 md:grid-cols-4">
            {stageTimeline.map((stage, index) => {
              const isCurrent = stage.state === "current";
              const isDone = stage.state === "done";
              return (
                <div key={stage.statusKey} className="relative">
                  {index < stageTimeline.length - 1 ? (
                    <span
                      className={`absolute left-[calc(50%+1rem)] right-[-1rem] top-3 hidden h-px md:block ${
                        isDone ? "bg-emerald-300/70" : "bg-white/10"
                      }`}
                    />
                  ) : null}
                  <div className="relative flex items-start gap-3 md:block">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        isCurrent || isDone
                          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                          : "border-white/10 bg-white/5 text-zinc-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 md:mt-3">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent || isDone ? "text-white" : "text-zinc-500"
                        }`}
                      >
                        {stage.label}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">{stage.description}</p>
                      {stage.date ? (
                        <p className="mt-2 text-[11px] text-zinc-400">
                          {new Date(stage.date).toLocaleString(locale)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/72">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{t("labels.products")}</p>
              <p className="mt-1 text-sm text-zinc-300">{t("labels.items", { count: order.items.length })}</p>
            </div>
            <p className="text-sm font-medium text-zinc-200">
              {formatMoney(order.subtotalCents, order.currency, locale)}
            </p>
          </div>
        </div>

        <ul
          className={`divide-y divide-white/10 px-5 md:px-6 ${
            hasScrollableItems ? "max-h-[320px] overflow-y-auto pr-2 [scrollbar-width:thin]" : ""
          }`}
        >
          {order.items.map((item) => {
            const optionParts = [
              item.optionColor ? `${isFr ? "Couleur" : "Color"}: ${item.optionColor}` : null,
              item.optionSize ? `${isFr ? "Taille" : "Size"}: ${item.optionSize}` : null,
            ].filter(Boolean);
            const lineTotal = item.unitPriceCents * item.quantity;

            return (
              <li key={item.id} className="py-4 transition duration-200 hover:bg-white/[0.02]">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80">
                    {item.product?.images?.[0]?.url ? (
                      <img src={item.product.images[0].url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {item.product?.slug ? (
                      <Link
                        href={`/shop/${item.product.slug}`}
                        className="block truncate text-sm font-semibold text-white transition hover:text-emerald-200"
                      >
                        {item.product.title}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold text-white">
                        {item.product?.title ?? t("labels.unknown")}
                      </p>
                    )}
                    {optionParts.length > 0 ? (
                      <p className="mt-1 text-[11px] text-zinc-500">{optionParts.join(" - ")}</p>
                    ) : null}
                    {canReviewOrder && item.product?.id ? (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewTarget({
                            productId: item.product!.id,
                            title: item.product?.title ?? t("labels.unknown"),
                          })
                        }
                        className="mt-2 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition duration-200 hover:border-emerald-300/40 hover:bg-emerald-400/15 hover:text-emerald-50"
                      >
                        {t("detail.reviewCta")}
                      </button>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">
                      {formatMoney(lineTotal, order.currency, locale)}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      x{item.quantity} - {formatMoney(item.unitPriceCents, order.currency, locale)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-white/10 px-5 py-5 md:px-6">
          <div className="ml-auto max-w-sm space-y-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>{isFr ? "Sous-total" : "Subtotal"}</span>
              <span>{formatMoney(order.subtotalCents, order.currency, locale)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("labels.fees")}</span>
              <span>{formatMoney(order.feesCents, order.currency, locale)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <span>{t("labels.total")}</span>
              <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-stretch">
        <section className="flex h-[430px] min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/72 px-5 py-5 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{t("labels.tracking")}</p>
              <p className="mt-1 text-sm text-zinc-300">
                {isFr ? "Chaque etape de suivi en un coup d'oeil." : "Every delivery step at a glance."}
              </p>
            </div>
          </div>

          <div className="mt-5 flex-1">
            <div className="flex h-full flex-col justify-between gap-5">
              {stageTimeline.map((stage, index) => {
                const isDone = index <= currentStageIndex;
                return (
                  <div key={stage.statusKey} className="relative pl-8">
                    {index < stageTimeline.length - 1 ? (
                      <span className="absolute left-[11px] top-7 h-[calc(100%+1.1rem)] w-px bg-white/10" />
                    ) : null}
                    <span
                      className={`absolute left-0 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[12px] font-semibold ${
                        isDone
                          ? "border-emerald-300/35 bg-emerald-400/12 text-emerald-200"
                          : "border-rose-300/20 bg-rose-400/8 text-rose-200"
                      }`}
                    >
                      {isDone ? "\u2713" : "\u00d7"}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{stage.label}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {stage.date
                              ? new Date(stage.date).toLocaleString(locale)
                              : isFr
                                ? "Pas encore atteint"
                                : "Not reached yet"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
                            isDone
                              ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                              : "border-white/10 bg-white/5 text-zinc-400"
                          }`}
                        >
                          {isDone ? (isFr ? "Fait" : "Done") : (isFr ? "En attente" : "Pending")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">{stage.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex h-[430px] min-h-0 flex-col gap-4">
          <section className="flex min-h-0 flex-[0.95] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,25,33,0.96),rgba(12,16,21,0.94))] p-4 shadow-[0_28px_70px_-52px_rgba(16,185,129,0.5)]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 md:gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("detail.seller")}</p>
                </div>
                {order.seller?.slug ? (
                  <Link
                    href={`/stores/${order.seller.slug}`}
                    className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-400/15"
                  >
                    {order.seller.slug}
                  </Link>
                ) : null}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-950 ring-4 ring-white/5">
                  {order.seller?.user?.image ? (
                    <img
                      src={order.seller.user.image}
                      alt={sellerIdentity}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-200">
                      {sellerInitial}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white md:text-base">{sellerIdentity}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {sellerRatingValue.toFixed(1)} / 5
                    {sellerRatingCount > 0 ? ` (${sellerRatingCount})` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {isFr ? "Fiabilite et historique visibles en un coup d'oeil." : "Reliability at a glance."}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-[11px] text-zinc-400">
                <div className="min-w-0">
                  <p className="uppercase tracking-[0.16em] text-zinc-500">{t("detail.sellerProducts")}</p>
                  <p className="mt-1 text-base font-semibold text-zinc-100 md:text-lg">
                    {order.sellerStats?.activeProducts ?? 0}
                  </p>
                </div>
                <div className="min-w-0 border-l border-white/10 pl-3">
                  <p className="uppercase tracking-[0.16em] text-zinc-500">
                    {isFr ? "Transaction" : "Transactions"}
                  </p>
                  <p className="mt-1 text-base font-semibold text-zinc-100 md:text-lg">
                    {order.sellerStats?.paidOrders ?? 0}
                  </p>
                </div>
                <div className="min-w-0 border-l border-white/10 pl-3">
                  <p className="uppercase tracking-[0.16em] text-zinc-500">{t("detail.sellerReviews")}</p>
                  <p className="mt-1 text-base font-semibold text-zinc-100 md:text-lg">{sellerRatingCount}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-[1.05] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/72 text-sm text-zinc-300">
            <div className="grid h-full gap-0 md:grid-cols-2">
              <div className="p-4 md:p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("detail.contact")}</p>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      {isFr ? "Nom" : "Name"}
                    </p>
                    <p className="mt-1 text-white">{order.buyerName || t("labels.noEmail")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Email</p>
                    <p className="mt-1 text-white">{order.buyerEmail || t("labels.noEmail")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      {isFr ? "Telephone" : "Phone"}
                    </p>
                    <p className="mt-1 text-white">{order.buyerPhone || t("detail.noPhone")}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 p-4 md:border-l md:border-t-0 md:p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("labels.shipping")}</p>
                <div className="mt-2.5 space-y-2">
                  <p className="text-white">{order.shippingAddress || t("labels.shippingEmpty")}</p>
                  {order.shippingCity ? <p className="text-zinc-400">{order.shippingCity}</p> : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {recommendedProducts.length > 0 ? (
          <CompactRecommendationRail
            title={isFr ? "Vous aimerez aussi" : "You may also like"}
            subtitle={
              isFr
                ? "Une selection plus inspiree pour prolonger cet achat."
                : "A more curated selection to extend this order."
            }
            products={recommendedProducts}
            locale={locale}
            className="h-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,31,0.94),rgba(12,16,21,0.94))] p-5 md:p-6"
          />
        ) : (
          <section className="h-full rounded-[28px] border border-white/10 bg-zinc-900/72 p-5 md:p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {isFr ? "Vous aimerez aussi" : "You may also like"}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {isFr
                ? "Une selection plus inspiree pour prolonger cet achat."
                : "A more curated selection to extend this order."}
            </p>
            <p className="mt-6 text-sm text-zinc-500">
              {isFr ? "Aucune suggestion pour le moment." : "No suggestions for now."}
            </p>
          </section>
        )}

        <section className="h-full rounded-[28px] border border-white/10 bg-zinc-900/72 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {t("labels.messages")}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {isFr ? "Conversation avec le vendeur" : "Conversation with the seller"}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400">
              {order.messages?.length ?? 0}
            </span>
          </div>

          <div className="mt-4 grid max-h-[260px] gap-2 overflow-y-auto pr-1">
            {order.messages && order.messages.length > 0 ? (
              order.messages.map((message) => {
                const isCustomer = message.senderRole === "CUSTOMER";
                return (
                  <div key={message.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl border px-3 py-2 text-[11px] ${
                        isCustomer
                          ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-50"
                          : "border-white/10 bg-zinc-950/70 text-zinc-200"
                      }`}
                    >
                      <p className="text-[10px] text-zinc-500">
                        {t(`sender.${(message.senderRole ?? "SYSTEM").toLowerCase()}`)} -{" "}
                        {new Date(message.createdAt).toLocaleString(locale)}
                      </p>
                      <p className="mt-1">{message.body}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] text-zinc-500">{t("detail.noMessages")}</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-2.5 text-xs text-white outline-none transition focus:border-emerald-300/40"
              placeholder={t("detail.messagePlaceholder")}
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                void sendMessage();
              }}
              disabled={sending}
              className="rounded-2xl bg-emerald-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 disabled:opacity-60"
            >
              {sending ? t("detail.sending") : t("detail.send")}
            </button>
          </div>
        </section>
      </div>

      {reviewTarget ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm md:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t("detail.reviewForm.title")}
          onClick={() => setReviewTarget(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(12,16,21,0.98))] p-5 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.65)] md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {t("detail.reviewForm.title")}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{reviewTarget.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {locale === "fr"
                    ? "Laisse ton avis sans casser la lecture de la commande."
                    : "Leave your review without breaking the order flow."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white transition hover:border-white/40 hover:bg-white/10"
              >
                {locale === "fr" ? "Fermer" : "Close"}
              </button>
            </div>

            <div className="mt-4">
              <InlineReviewForm productId={reviewTarget.productId} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


