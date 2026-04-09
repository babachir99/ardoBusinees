"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import InlineReviewForm from "@/components/orders/InlineReviewForm";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import AddToCartButton from "@/components/cart/AddToCartButton";

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

type RecommendedProduct = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  currency: string;
  discountPercent?: number | null;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  stockQuantity?: number | null;
  images: { url: string }[];
  seller?: { displayName: string; slug: string } | null;
};

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
  const isFr = locale === "fr";
  const lowStockBadge = isFr ? "Stock faible" : "Low stock";
  const soldOutHint = isFr
    ? "Ce produit est momentanement epuise. Reviens un peu plus tard ou essaie une autre suggestion."
    : "This product is temporarily sold out. Check back later or try another suggestion.";
  const lowStockHint = (count: number) =>
    isFr ? `Plus que ${count} article(s) disponible(s).` : `Only ${count} item(s) left.`;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-semibold text-white">{product.title}</p>
                  {isSoldOut ? (
                    <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                      {isFr ? "Epuise" : "Sold out"}
                    </span>
                  ) : isLowStock ? (
                    <span className="shrink-0 rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200">
                      {lowStockBadge}
                    </span>
                  ) : null}
                </div>
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
                  disabled={isSoldOut}
                  className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                />
              </div>
              {isSoldOut ? (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-100/80">
                  {soldOutHint}
                </p>
              ) : isLowStock ? (
                <p className="mt-3 text-[11px] leading-relaxed text-orange-100/80">
                  {lowStockHint(localStock ?? 0)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
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

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("detail.title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("detail.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/orders"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("detail.back")}
          </Link>
          <button
            type="button"
            onClick={() => {
              void loadOrder();
            }}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("detail.refresh")}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("labels.order")}</p>
          <p className="mt-1 text-sm text-white">{order.id}</p>
          <p className="mt-2">{new Date(order.createdAt).toLocaleString(locale)}</p>
          <p className="mt-2">{t(`status.${order.status.toLowerCase()}`)}</p>
          <p className="mt-1">{t(`payment.${order.paymentStatus.toLowerCase()}`)}</p>
          <p className="mt-1">{order.paymentMethod ?? "-"}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("detail.contact")}</p>
          <p className="mt-1">{order.buyerName || t("labels.noEmail")}</p>
          <p className="mt-1">{order.buyerEmail || t("labels.noEmail")}</p>
          <p className="mt-1">{order.buyerPhone || t("detail.noPhone")}</p>
          <p className="mt-3 text-xs text-zinc-400">{t("labels.shipping")}</p>
          <p className="mt-1">{order.shippingAddress || t("labels.shippingEmpty")}</p>
          {order.shippingCity && <p className="mt-1">{order.shippingCity}</p>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("detail.seller")}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-900">
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

          <p className="mt-3 text-xs text-zinc-400">{t("detail.store")}</p>
          {order.seller?.slug ? (
            <Link
              href={`/stores/${order.seller.slug}`}
              className="mt-1 inline-flex rounded-full border border-white/20 px-3 py-1 text-[11px] text-white transition hover:border-emerald-300/60"
            >
              {order.seller.slug}
            </Link>
          ) : (
            <p className="mt-1 text-zinc-400">-</p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-2">
              <p>{t("detail.sellerProducts")}</p>
              <p className="mt-1 font-semibold text-zinc-100">
                {order.sellerStats?.activeProducts ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-2">
              <p>{t("detail.sellerPaidOrders")}</p>
              <p className="mt-1 font-semibold text-zinc-100">{order.sellerStats?.paidOrders ?? 0}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-2">
              <p>{t("detail.sellerReviews")}</p>
              <p className="mt-1 font-semibold text-zinc-100">{sellerRatingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
        <p className="text-xs text-zinc-400">{t("labels.products")}</p>
        <ul className="mt-3 grid gap-3">
          {order.items.map((item) => {
            const optionParts = [
              item.optionColor
                ? `${locale === "fr" ? "Couleur" : "Color"}: ${item.optionColor}`
                : null,
              item.optionSize ? `${locale === "fr" ? "Taille" : "Size"}: ${item.optionSize}` : null,
            ].filter(Boolean);

            return (
              <li key={item.id} className="rounded-xl border border-white/10 bg-zinc-900/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
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
                      <p className="truncate">{item.product?.title ?? t("labels.unknown")}</p>
                      {optionParts.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-zinc-500">{optionParts.join(" - ")}</p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-zinc-400">x{item.quantity}</span>
                </div>

                {canReviewOrder && item.product?.id && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-emerald-300 underline underline-offset-2">
                      {t("detail.reviewCta")}
                    </summary>
                    <InlineReviewForm productId={item.product.id} />
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </div>

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

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
        <div className="flex items-center justify-between">
          <span>{t("labels.items", { count: order.items.length })}</span>
          <span>{formatMoney(order.subtotalCents, order.currency, locale)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>{t("labels.fees")}</span>
          <span>{formatMoney(order.feesCents, order.currency, locale)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between font-semibold text-white">
          <span>{t("labels.total")}</span>
          <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
        </div>
      </div>

      {order.events.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("labels.tracking")}</p>
          <div className="mt-3 grid gap-2 text-xs text-zinc-400">
            {order.events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {t(`status.${event.status.toLowerCase()}`)} -{" "}
                  {new Date(event.createdAt).toLocaleString(locale)}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {event.note && <span>{event.note}</span>}
                  {event.proofUrl && (
                    <a
                      href={event.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-200 underline"
                    >
                      {t("labels.proof")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-400">{t("labels.messages")}</p>
        <div className="mt-3 grid gap-2">
          {order.messages && order.messages.length > 0 ? (
            order.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderRole === "CUSTOMER" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[70%] rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-200">
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
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
          >
            {sending ? t("detail.sending") : t("detail.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

