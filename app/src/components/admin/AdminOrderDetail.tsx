"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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

export default function AdminOrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("AdminOrders");
  const locale = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadOrder = async () => {
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
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

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
          onClick={loadOrder}
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
          <p className="mt-2">{t("labels.date")} {new Date(order.createdAt).toLocaleString(locale)}</p>
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
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span className="truncate">{item.product?.title ?? t("labels.unknown")}</span>
              <span className="text-zinc-400">x{item.quantity}</span>
            </li>
          ))}
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
                  uploadProof(file);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const status = (
                document.getElementById("status-detail") as HTMLSelectElement
              )?.value;
              const note = (
                document.getElementById("note-detail") as HTMLInputElement
              )?.value;
              const proofUrl = (
                document.getElementById("proof-detail") as HTMLInputElement
              )?.value;
              addEvent(order.id, status, note, proofUrl);
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
                {t(`status.${event.status.toLowerCase()}`)} ·{" "}
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
