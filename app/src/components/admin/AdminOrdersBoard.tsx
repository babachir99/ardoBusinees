"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";

type OrderEvent = {
  id: string;
  status: string;
  note?: string | null;
  proofUrl?: string | null;
  createdAt: string;
};

type Order = {
  id: string;
  buyerEmail?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  events?: OrderEvent[];
  items?: { id: string }[];
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

export default function AdminOrdersBoard() {
  const t = useTranslations("AdminOrders");
  const locale = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("take", "30");
      if (statusFilter) params.set("status", statusFilter);
      if (emailFilter) params.set("email", emailFilter);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Order[];
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [emailFilter, statusFilter, t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const addEvent = async (
    orderId: string,
    status: string,
    note: string,
    proofUrl: string
  ) => {
    setSavingId(orderId);
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
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setSavingId(null);
    }
  };

  const uploadProof = async (orderId: string, file: File) => {
    setUploadingId(orderId);
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
      const proofInput = document.getElementById(
        `proof-${orderId}`
      ) as HTMLInputElement | null;
      if (proofInput) {
        proofInput.value = json.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload"));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("refresh")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300 sm:grid-cols-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder={t("filters.email")}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("filters.all")}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status.toLowerCase()}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadOrders}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("filters.apply")}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      {loading && (
        <p className="mt-6 text-sm text-zinc-400">{t("loading")}</p>
      )}

      {!loading && orders.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>
      )}

      {orders.length > 0 && (
        <div className="mt-6 grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">{t("labels.order")}</p>
                  <p className="text-sm font-semibold text-white">
                    {order.id.slice(0, 10)}...
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(order.createdAt).toLocaleString(locale)}
                  </p>
                  <p className="mt-2 text-xs text-zinc-300">
                    {t("labels.customer")}:{" "}
                    {order.buyerName || order.buyerEmail || t("labels.noEmail")}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>{order.buyerEmail || t("labels.noEmail")}</p>
                  <p>{t(`status.${order.status.toLowerCase()}`)}</p>
                  <p>{t(`payment.${order.paymentStatus.toLowerCase()}`)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
                <span>{order.paymentMethod ?? t("labels.noMethod")}</span>
                <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span>
                  {t("labels.items")} {order.items?.length ?? 0}
                </span>
                <span>
                  {order.shippingAddress
                    ? `${order.shippingAddress} ${order.shippingCity ?? ""}`
                    : t("labels.shippingEmpty")}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-400">
                  {t("labels.quickActions")}
                </span>
                {["CONFIRMED", "FULFILLING", "SHIPPED", "DELIVERED"].map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => addEvent(order.id, status, "", "")}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white transition hover:border-emerald-300/60"
                    >
                      {t(`status.${status.toLowerCase()}`)}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => addEvent(order.id, "CANCELED", "", "")}
                  className="rounded-full border border-rose-300/40 px-3 py-1 text-[11px] text-rose-200 transition hover:border-rose-300/70"
                >
                  {t("status.canceled")}
                </button>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                <p className="text-xs text-zinc-400">{t("labels.newEvent")}</p>
                <div className="grid gap-3 md:grid-cols-5">
                  <select
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
                    defaultValue={order.status}
                    id={`status-${order.id}`}
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
                    id={`note-${order.id}`}
                  />
                  <input
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
                    placeholder={t("labels.proof")}
                    id={`proof-${order.id}`}
                  />
                  <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] text-zinc-300">
                    {uploadingId === order.id ? t("uploading") : t("labels.upload")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadProof(order.id, file);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const status = (
                        document.getElementById(`status-${order.id}`) as HTMLSelectElement
                      )?.value;
                      const note = (
                        document.getElementById(`note-${order.id}`) as HTMLInputElement
                      )?.value;
                      const proofUrl = (
                        document.getElementById(`proof-${order.id}`) as HTMLInputElement
                      )?.value;
                      addEvent(order.id, status, note, proofUrl);
                    }}
                    disabled={savingId === order.id}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                  >
                    {savingId === order.id ? t("saving") : t("submit")}
                  </button>
                </div>
              </div>

              <a
                href={`/${locale}/admin/orders/${order.id}`}
                className="mt-4 inline-flex text-xs text-emerald-300 underline"
              >
                {t("labels.view")}
              </a>

              {order.events && order.events.length > 0 && (
                <div className="mt-4 grid gap-2 text-xs text-zinc-400">
                  {order.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span>
                        {t(`status.${event.status.toLowerCase()}`)} ·{" "}
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
