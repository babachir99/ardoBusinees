"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

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
  seller?: { id: string; displayName: string; slug: string } | null;
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  messages: OrderMessage[];
};

export default function OrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");

  const loadOrder = async () => {
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
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

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
            onClick={loadOrder}
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
          <p className="mt-1 text-sm text-white">
            {order.seller?.displayName || t("detail.unknownSeller")}
          </p>
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
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
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
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {optionParts.join(" - ")}
                      </p>
                    )}
                    {canReviewOrder && item.product?.slug && (
                      <a
                        href={`/${locale}/shop/${item.product.slug}#reviews`}
                        className="mt-1 inline-flex text-[11px] text-emerald-300 underline underline-offset-2"
                      >
                        {t("detail.reviewCta")}
                      </a>
                    )}
                  </div>
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
                className={`flex ${
                  message.senderRole === "CUSTOMER" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="max-w-[70%] rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-200">
                  <p className="text-[10px] text-zinc-500">
                    {t(
                      `sender.${(message.senderRole ?? "SYSTEM").toLowerCase()}`
                    )}{" "}
                    - {new Date(message.createdAt).toLocaleString(locale)}
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
            onChange={(e) => setMessageDraft(e.target.value)}
          />
          <button
            type="button"
            onClick={sendMessage}
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
