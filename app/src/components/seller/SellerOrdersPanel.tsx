"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  items: { id: string; quantity: number }[];
  events?: OrderEvent[];
  messages?: OrderMessage[];
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

export default function SellerOrdersPanel() {
  const t = useTranslations("SellerSpace");
  const locale = useLocale();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [proofDrafts, setProofDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("take", "50");
      if (statusFilter) params.set("status", statusFilter);
      if (emailFilter) params.set("email", emailFilter);
      if (rangeFilter && rangeFilter !== "all") params.set("range", rangeFilter);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.loadOrders"));
      }
      const data = (await res.json()) as Order[];
      setItems(data);
      setStatusDrafts(
        Object.fromEntries(
          data.map((order) => [order.id, order.status])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadOrders"));
    } finally {
      setLoading(false);
    }
  }, [emailFilter, rangeFilter, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

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
        throw new Error(data?.error || t("orders.errors.save"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.errors.save"));
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
        throw new Error(err?.error || t("orders.errors.upload"));
      }
      const json = (await res.json()) as { url: string };
      setProofDrafts((prev) => ({ ...prev, [orderId]: json.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.errors.upload"));
    } finally {
      setUploadingId(null);
    }
  };

  const sendMessage = async (orderId: string) => {
    const message = (messageDrafts[orderId] ?? "").trim();
    if (!message) {
      return;
    }
    setSendingId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("orders.errors.message"));
      }
      setMessageDrafts((prev) => ({ ...prev, [orderId]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.errors.message"));
    } finally {
      setSendingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((order) => {
      if (!emailFilter) return true;
      const target = `${order.buyerEmail ?? ""} ${order.buyerName ?? ""}`.toLowerCase();
      return target.includes(emailFilter.toLowerCase());
    });
  }, [items, emailFilter]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("orders.title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("orders.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("orders.refresh")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300 sm:grid-cols-4">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder={t("orders.filters.email")}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("orders.filters.all")}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {t(`orders.status.${status.toLowerCase()}`)}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={rangeFilter}
          onChange={(e) => setRangeFilter(e.target.value)}
        >
          <option value="all">{t("orders.filters.rangeAll")}</option>
          <option value="7">{t("orders.filters.range7")}</option>
          <option value="30">{t("orders.filters.range30")}</option>
          <option value="90">{t("orders.filters.range90")}</option>
          <option value="365">{t("orders.filters.range365")}</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("orders.filters.apply")}
        </button>
      </div>

      {filteredItems.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("orders.empty")}</p>
      )}

      {filteredItems.length > 0 && (
        <div className="mt-6 grid gap-4">
          {filteredItems.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">{t("orders.labels.order")}</p>
                  <p className="text-sm font-semibold text-white">
                    {order.id.slice(0, 10)}...
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(order.createdAt).toLocaleString(locale)}
                  </p>
                  <p className="mt-2 text-xs text-zinc-300">
                    {t("orders.labels.customer")}:{" "}
                    {order.buyerName || order.buyerEmail || t("orders.unknown")}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>{order.buyerEmail || t("orders.labels.noEmail")}</p>
                  <p>{t(`orders.status.${order.status.toLowerCase()}`)}</p>
                  <p>{t(`orders.payment.${order.paymentStatus.toLowerCase()}`)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                <span>
                  {t("orders.labels.items")} {order.items?.length ?? 0}
                </span>
                <Link
                  href={`/seller/orders/${order.id}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white transition hover:border-emerald-300/60"
                >
                  {t("orders.labels.view")}
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
                <span>
                  {t("orders.labels.method")}:{" "}
                  {order.paymentMethod ?? t("orders.labels.noMethod")}
                </span>
                <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span>
                  {order.shippingAddress
                    ? `${order.shippingAddress} ${order.shippingCity ?? ""}`
                    : t("orders.labels.shippingEmpty")}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-400">
                  {t("orders.labels.quickActions")}
                </span>
                {["CONFIRMED", "FULFILLING", "SHIPPED", "DELIVERED"].map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => addEvent(order.id, status, "", "")}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white transition hover:border-emerald-300/60"
                    >
                      {t(`orders.status.${status.toLowerCase()}`)}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => addEvent(order.id, "CANCELED", "", "")}
                  className="rounded-full border border-rose-300/40 px-3 py-1 text-[11px] text-rose-200 transition hover:border-rose-300/70"
                >
                  {t("orders.status.canceled")}
                </button>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                <p className="text-xs text-zinc-400">{t("orders.labels.newEvent")}</p>
                <div className="grid gap-3 md:grid-cols-5">
                  <select
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
                    value={statusDrafts[order.id] ?? order.status}
                    onChange={(e) =>
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [order.id]: e.target.value,
                      }))
                    }
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
                    value={noteDrafts[order.id] ?? ""}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [order.id]: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
                    placeholder={t("orders.labels.proof")}
                    value={proofDrafts[order.id] ?? ""}
                    onChange={(e) =>
                      setProofDrafts((prev) => ({
                        ...prev,
                        [order.id]: e.target.value,
                      }))
                    }
                  />
                  <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] text-zinc-300">
                    {uploadingId === order.id
                      ? t("orders.uploading")
                      : t("orders.labels.upload")}
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
                    onClick={() =>
                      addEvent(
                        order.id,
                        statusDrafts[order.id] ?? order.status,
                        noteDrafts[order.id] ?? "",
                        proofDrafts[order.id] ?? ""
                      )
                    }
                    disabled={savingId === order.id}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                  >
                    {savingId === order.id ? t("orders.saving") : t("orders.submit")}
                  </button>
                </div>
              </div>

              {order.events && order.events.length > 0 && (
                <div className="mt-4 grid gap-2 text-xs text-zinc-400">
                  <p className="text-[11px] text-zinc-500">{t("orders.labels.timeline")}</p>
                  {order.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span>
                        {t(`orders.status.${event.status.toLowerCase()}`)} ·{" "}
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

              <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                <p className="text-xs text-zinc-400">{t("orders.labels.messages")}</p>
                <div className="mt-3 grid gap-2">
                  {order.messages && order.messages.length > 0 ? (
                    order.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderRole === "SELLER"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div className="max-w-[70%] rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-200">
                          <p className="text-[10px] text-zinc-500">
                            {t(
                              `orders.sender.${(message.senderRole ?? "SYSTEM").toLowerCase()}`
                            )}{" "}
                            · {new Date(message.createdAt).toLocaleString(locale)}
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
                    value={messageDrafts[order.id] ?? ""}
                    onChange={(e) =>
                      setMessageDrafts((prev) => ({
                        ...prev,
                        [order.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => sendMessage(order.id)}
                    disabled={sendingId === order.id}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                  >
                    {sendingId === order.id ? t("orders.sending") : t("orders.labels.send")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
