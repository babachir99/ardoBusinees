"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type OrderEvent = {
  id: string;
  status: string;
  note?: string | null;
  proofUrl?: string | null;
  createdAt: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  optionColor?: string | null;
  optionSize?: string | null;
  product?: { id: string; title: string; slug: string; images?: { url: string }[] } | null;
};

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
  paymentStatus: string;
  paymentMethod?: string | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  events: OrderEvent[];
};

const statusOptions = [
  "PENDING",
  "CONFIRMED",
  "FULFILLING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "REFUNDED",
];

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
    <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
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
              className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 transition hover:border-emerald-300/60"
            >
              <div className="h-28 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
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

export default function AdminOrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("AdminOrders");
  const locale = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        throw new Error(data?.error || t("errors.load"));
      }
      const data = (await res.json()) as Order;
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
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

  const addEvent = async (status: string, note: string, proofUrl: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note: note || undefined,
          proofUrl: proofUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const uploadProof = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || t("errors.upload"));
      }
      const json = (await res.json()) as { url: string };
      const proofInput = document.getElementById("proof-detail") as HTMLInputElement | null;
      if (proofInput) {
        proofInput.value = json.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload"));
    } finally {
      setUploading(false);
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

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("detail.title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("detail.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadOrder();
          }}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("refresh")}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("labels.order")}</p>
          <p className="mt-1 text-sm text-white">{order.id}</p>
          <p className="mt-2">
            {t("labels.date")} {new Date(order.createdAt).toLocaleString(locale)}
          </p>
          <p className="mt-2">{t(`status.${order.status.toLowerCase()}`)}</p>
          <p className="mt-1">{t(`payment.${order.paymentStatus.toLowerCase()}`)}</p>
          <p className="mt-1">{order.paymentMethod ?? t("labels.noMethod")}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("detail.customer")}</p>
          <p className="mt-1">{order.buyerName || t("labels.noEmail")}</p>
          <p className="mt-1">{order.buyerEmail || t("labels.noEmail")}</p>
          <p className="mt-1">{order.buyerPhone || t("detail.noPhone")}</p>
          <p className="mt-3 text-xs text-zinc-400">{t("labels.shipping")}</p>
          <p className="mt-1">{order.shippingAddress || t("labels.shippingEmpty")}</p>
          {order.shippingCity && <p className="mt-1">{order.shippingCity}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
        <p className="text-xs text-zinc-400">{t("labels.products")}</p>
        <ul className="mt-3 grid gap-2">
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
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate">{item.product?.title ?? t("labels.unknown")}</p>
                  {optionParts.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">{optionParts.join(" - ")}</p>
                  )}
                </div>
                <span className="shrink-0 text-zinc-400">x{item.quantity}</span>
              </li>
            );
          })}
        </ul>
      </div>

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
        <p className="text-xs text-zinc-400">{t("labels.newEvent")}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <select
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            defaultValue={order.status}
            id="status-detail"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status.toLowerCase()}`)}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder={t("labels.note")}
            id="note-detail"
          />
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder={t("labels.proof")}
            id="proof-detail"
          />
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] text-zinc-300">
            {uploading ? t("uploading") : t("labels.upload")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void uploadProof(file);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const status = (document.getElementById("status-detail") as HTMLSelectElement)?.value;
              const note = (document.getElementById("note-detail") as HTMLInputElement)?.value;
              const proofUrl = (document.getElementById("proof-detail") as HTMLInputElement)?.value;
              void addEvent(status, note, proofUrl);
            }}
            disabled={saving}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60 md:col-span-4"
          >
            {saving ? t("saving") : t("submit")}
          </button>
        </div>
      </div>

      {order.events.length > 0 && (
        <div className="mt-6 grid gap-2 text-xs text-zinc-400">
          {order.events.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {t(`status.${event.status.toLowerCase()}`)} -{" "}
                {new Date(event.createdAt).toLocaleString(locale)}
              </span>
              {event.note && <span>{event.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


