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
  product?: { id: string; title: string; slug: string } | null;
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
  messages: OrderMessage[];
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

export default function SellerOrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("SellerSpace");
  const locale = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusDraft, setStatusDraft] = useState("PENDING");
  const [noteDraft, setNoteDraft] = useState("");
  const [proofDraft, setProofDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.loadOrders"));
      }
      const data = (await res.json()) as Order;
      setOrder(data);
      setStatusDraft(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadOrders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const addEvent = async () => {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft,
          note: noteDraft || undefined,
          proofUrl: proofDraft || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("orders.errors.save"));
      }
      setNoteDraft("");
      setProofDraft("");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.errors.save"));
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
        throw new Error(err?.error || t("orders.errors.upload"));
      }
      const json = (await res.json()) as { url: string };
      setProofDraft(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.errors.upload"));
    } finally {
      setUploading(false);
    }
  };

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
        throw new Error(data?.error || t("orders.errors.message"));
      }
      setMessageDraft("");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.errors.message"));
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
        <p className="text-sm text-zinc-400">{t("orders.empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("orders.detail.title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("orders.detail.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/seller/orders"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("orders.detail.back")}
          </Link>
          <button
            type="button"
            onClick={loadOrder}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("orders.refresh")}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("orders.labels.order")}</p>
          <p className="mt-1 text-sm text-white">{order.id}</p>
          <p className="mt-2">{new Date(order.createdAt).toLocaleString(locale)}</p>
          <p className="mt-2">{t(`orders.status.${order.status.toLowerCase()}`)}</p>
          <p className="mt-1">{t(`orders.payment.${order.paymentStatus.toLowerCase()}`)}</p>
          <p className="mt-1">{order.paymentMethod ?? t("orders.labels.noMethod")}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
          <p className="text-xs text-zinc-400">{t("orders.detail.customer")}</p>
          <p className="mt-1">{order.buyerName || t("orders.labels.noEmail")}</p>
          <p className="mt-1">{order.buyerEmail || t("orders.labels.noEmail")}</p>
          <p className="mt-1">{order.buyerPhone || t("orders.detail.noPhone")}</p>
          <p className="mt-3 text-xs text-zinc-400">{t("orders.labels.shipping")}</p>
          <p className="mt-1">{order.shippingAddress || t("orders.labels.shippingEmpty")}</p>
          {order.shippingCity && <p className="mt-1">{order.shippingCity}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
        <p className="text-xs text-zinc-400">{t("orders.labels.products")}</p>
        <ul className="mt-3 grid gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span className="truncate">
                {item.product?.title ?? t("orders.labels.unknownProduct")}
              </span>
              <span className="text-zinc-400">x{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
        <div className="flex items-center justify-between">
          <span>{t("orders.labels.items")} {order.items.length}</span>
          <span>{formatMoney(order.subtotalCents, order.currency, locale)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>{t("orders.labels.fees")}</span>
          <span>{formatMoney(order.feesCents, order.currency, locale)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between font-semibold text-white">
          <span>{t("orders.labels.total")}</span>
          <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300">
        <p className="text-xs text-zinc-400">{t("orders.labels.newEvent")}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <select
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {t(`orders.status.${status.toLowerCase()}`)}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder={t("orders.labels.note")}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder={t("orders.labels.proof")}
            value={proofDraft}
            onChange={(e) => setProofDraft(e.target.value)}
          />
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] text-zinc-300">
            {uploading ? t("orders.uploading") : t("orders.labels.upload")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadProof(file);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={addEvent}
            disabled={saving}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60 md:col-span-5"
          >
            {saving ? t("orders.saving") : t("orders.submit")}
          </button>
        </div>
      </div>

      {order.events.length > 0 && (
        <div className="mt-6 grid gap-2 text-xs text-zinc-400">
          <p className="text-[11px] text-zinc-500">{t("orders.labels.timeline")}</p>
          {order.events.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {t(`orders.status.${event.status.toLowerCase()}`)} -{" "}
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
                    {t("orders.labels.proof")}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-400">{t("orders.labels.messages")}</p>
        <div className="mt-3 grid gap-2">
          {order.messages && order.messages.length > 0 ? (
            order.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderRole === "SELLER" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="max-w-[70%] rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-200">
                  <p className="text-[10px] text-zinc-500">
                    {t(
                      `orders.sender.${(message.senderRole ?? "SYSTEM").toLowerCase()}`
                    )}{" "}
                    - {new Date(message.createdAt).toLocaleString(locale)}
                  </p>
                  <p className="mt-1">{message.body}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-zinc-500">
              {t("orders.labels.noMessages")}
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
            placeholder={t("orders.labels.messagePlaceholder")}
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
          >
            {sending ? t("orders.sending") : t("orders.labels.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
