"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import InlineReviewForm from "@/components/orders/InlineReviewForm";
import ProductSuggestionGrid, {
  type ProductSuggestionItem,
} from "@/components/shop/ProductSuggestionGrid";

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
    : `#${order.id.slice(0, 10)}`;
  const orderDateLabel = new Date(order.createdAt).toLocaleString(locale);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                {t("detail.title")}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                {leadOrderTitle}
              </h1>
              <p className="mt-2 text-sm text-zinc-300">{t("detail.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                #{order.id.slice(0, 10)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                {orderDateLabel}
              </span>
              <span
                className={`rounded-full border px-3 py-1.5 font-medium uppercase tracking-[0.18em] ${getStatusTone(
                  order.status
                )}`}
              >
                {t(`status.${order.status.toLowerCase()}`)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/orders"
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              {t("detail.back")}
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadOrder();
              }}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              {t("detail.refresh")}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {t("labels.status")}
          </p>
          <p
            className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] ${getStatusTone(
              order.status
            )}`}
          >
            {t(`status.${order.status.toLowerCase()}`)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {t("labels.payment")}
          </p>
          <p
            className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] ${getPaymentTone(
              order.paymentStatus
            )}`}
          >
            {t(`payment.${order.paymentStatus.toLowerCase()}`)}
          </p>
          <p className="mt-2 text-xs text-zinc-400">{order.paymentMethod ?? "-"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {t("labels.items", { count: order.items.length })}
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">{order.items.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {t("labels.total")}
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatMoney(order.totalCents, order.currency, locale)}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 md:p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {t("labels.products")}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {t("labels.items", { count: order.items.length })}
              </p>
            </div>
            <ul className="mt-4 grid gap-3">
              {order.items.map((item) => {
                const optionParts = [
                  item.optionColor
                    ? `${locale === "fr" ? "Couleur" : "Color"}: ${item.optionColor}`
                    : null,
                  item.optionSize
                    ? `${locale === "fr" ? "Taille" : "Size"}: ${item.optionSize}`
                    : null,
                ].filter(Boolean);

                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/55 p-3 transition hover:border-white/15 hover:bg-zinc-900/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
                          {item.product?.images?.[0]?.url ? (
                            <img
                              src={item.product.images[0].url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          {item.product?.slug ? (
                            <Link
                              href={`/shop/${item.product.slug}`}
                              className="truncate text-sm font-semibold text-white transition hover:text-emerald-200"
                            >
                              {item.product.title}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-semibold text-white">
                              {item.product?.title ?? t("labels.unknown")}
                            </p>
                          )}
                          {optionParts.length > 0 && (
                            <p className="mt-0.5 text-[11px] text-zinc-500">{optionParts.join(" - ")}</p>
                          )}
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {formatMoney(item.unitPriceCents, order.currency, locale)}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                        x{item.quantity}
                      </span>
                    </div>

                    {canReviewOrder && item.product?.id && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[11px] font-medium text-emerald-300 underline underline-offset-2">
                          {t("detail.reviewCta")}
                        </summary>
                        <div className="mt-2">
                          <InlineReviewForm productId={item.product.id} />
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {order.events.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {t("labels.tracking")}
              </p>
              <div className="mt-4 grid gap-3">
                {order.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/50 p-3 text-xs text-zinc-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getStatusTone(
                            event.status
                          )}`}
                        >
                          {t(`status.${event.status.toLowerCase()}`)}
                        </span>
                        <p className="text-[11px] text-zinc-500">
                          {new Date(event.createdAt).toLocaleString(locale)}
                        </p>
                      </div>
                      {event.proofUrl && (
                        <a
                          href={event.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/35 hover:bg-white/10"
                        >
                          {t("labels.proof")}
                        </a>
                      )}
                    </div>
                    {event.note && <p className="mt-3 text-[11px] text-zinc-300">{event.note}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <ProductSuggestionGrid
            title={t("detail.recommendedSimilarTitle")}
            subtitle={t("detail.recommendedSimilarSubtitle")}
            products={similarProducts}
            locale={locale}
            className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
          />

          <ProductSuggestionGrid
            title={t("detail.recommendedComplementaryTitle")}
            subtitle={t("detail.recommendedComplementarySubtitle")}
            products={complementaryProducts}
            locale={locale}
            className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
          />
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 md:p-5 text-xs text-zinc-300">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("labels.order")}</p>
            <p className="mt-3 text-sm font-semibold text-white">#{order.id.slice(0, 10)}</p>
            <p className="mt-1 text-[11px] text-zinc-400">{orderDateLabel}</p>

            <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-zinc-900/55 p-3">
              <div className="flex items-center justify-between">
                <span>{t("labels.items", { count: order.items.length })}</span>
                <span>{formatMoney(order.subtotalCents, order.currency, locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("labels.fees")}</span>
                <span>{formatMoney(order.feesCents, order.currency, locale)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm font-semibold text-white">
                <span>{t("labels.total")}</span>
                <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 md:p-5 text-xs text-zinc-300">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("detail.contact")}</p>
            <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-zinc-900/55 p-3">
              <p>{order.buyerName || t("labels.noEmail")}</p>
              <p>{order.buyerEmail || t("labels.noEmail")}</p>
              <p>{order.buyerPhone || t("detail.noPhone")}</p>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t("labels.shipping")}
            </p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-900/55 p-3">
              <p>{order.shippingAddress || t("labels.shippingEmpty")}</p>
              {order.shippingCity && <p className="mt-1 text-zinc-400">{order.shippingCity}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 md:p-5 text-xs text-zinc-300">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("detail.seller")}</p>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/55 p-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-900">
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{sellerIdentity}</p>
                <p className="text-[11px] text-zinc-400">
                  {sellerRatingValue.toFixed(1)} / 5
                  {sellerRatingCount > 0 ? ` (${sellerRatingCount})` : ""}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {order.seller?.slug ? (
                <Link
                  href={`/stores/${order.seller.slug}`}
                  className="inline-flex rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition hover:border-emerald-300/60 hover:text-emerald-100"
                >
                  {order.seller.slug}
                </Link>
              ) : (
                <span className="text-zinc-400">-</span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-2.5">
                <p>{t("detail.sellerProducts")}</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {order.sellerStats?.activeProducts ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-2.5">
                <p>{t("detail.sellerPaidOrders")}</p>
                <p className="mt-1 font-semibold text-zinc-100">{order.sellerStats?.paidOrders ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-2.5">
                <p>{t("detail.sellerReviews")}</p>
                <p className="mt-1 font-semibold text-zinc-100">{sellerRatingCount}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {t("labels.messages")}
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400">
                {order.messages?.length ?? 0}
              </span>
            </div>
            <div className="mt-3 grid max-h-[280px] gap-2 overflow-y-auto pr-1">
              {order.messages && order.messages.length > 0 ? (
                order.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderRole === "CUSTOMER" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%] rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-200">
                      <p className="text-[10px] text-zinc-500">
                        {t(`sender.${(message.senderRole ?? "SYSTEM").toLowerCase()}`)} -{" "}
                        {new Date(message.createdAt).toLocaleString(locale)}
                      </p>
                      <p className="mt-1">{message.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-zinc-500">{t("detail.noMessages")}</p>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
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
                className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {sending ? t("detail.sending") : t("detail.send")}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

