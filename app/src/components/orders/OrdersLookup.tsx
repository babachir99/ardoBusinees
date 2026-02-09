"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";

type OrderItem = {
  id: string;
  productId: string;
  product?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  quantity: number;
  unitPriceCents: number;
  type: string;
  optionColor?: string | null;
  optionSize?: string | null;
};

type OrderEvent = {
  status: string;
  note?: string | null;
  proofUrl?: string | null;
  createdAt?: string;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalCents: number;
  subtotalCents: number;
  feesCents: number;
  currency: string;
  createdAt: string;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  items: OrderItem[];
  buyerEmail?: string | null;
  events?: OrderEvent[];
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

const steps = ["PENDING", "CONFIRMED", "FULFILLING", "SHIPPED", "DELIVERED"];

export default function OrdersLookup() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    if (!email) {
      setError(t("errors.email"));
      return;
    }
    setError(null);
    setState("loading");
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        throw new Error(t("errors.generic"));
      }
      const data = (await res.json()) as Order[];
      setOrders(data);
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setState("error");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-sm text-zinc-300">{t("subtitle")}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none sm:max-w-sm"
          placeholder={t("form.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          onClick={fetchOrders}
          disabled={state === "loading"}
          className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition disabled:opacity-60"
        >
          {state === "loading" ? t("form.loading") : t("form.submit")}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      {state === "success" && orders.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>
      )}

      {orders.length > 0 && (
        <div className="mt-6 grid gap-4">
          {orders.map((order) => {
            const orderIndex = steps.indexOf(order.status);
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">{t("labels.order")}</p>
                  <p className="text-sm font-semibold text-white">
                    {order.id.slice(0, 10)}...
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("labels.date")}{" "}
                    {new Date(order.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">{t("labels.status")}</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {t(`status.${statusMap[order.status] ?? "pending"}`)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("labels.payment")}{" "}
                    {t(`payment.${order.paymentStatus.toLowerCase()}`)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-4 text-xs text-zinc-300">
                <div className="flex items-center justify-between">
                  <span>{t("labels.items", { count: order.items.length })}</span>
                  <span>{formatMoney(order.subtotalCents, order.currency, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("labels.fees")}</span>
                  <span>{formatMoney(order.feesCents, order.currency, locale)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-white">
                  <span>{t("labels.total")}</span>
                  <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs text-zinc-400">{t("labels.tracking")}</p>
                <div className="mt-3 grid gap-2">
                  {((order.events?.length ? order.events : steps.map((status) => ({ status }))) as OrderEvent[]).map((event, index) => {
                    const stepKey = statusMap[event.status as keyof typeof statusMap] ?? "pending";
                    const stepIndex = steps.indexOf(event.status);
                    const done = order.status === "CANCELED" || order.status === "REFUNDED"
                      ? false
                      : stepIndex <= orderIndex;
                    return (
                      <div key={`${event.status}-${index}`} className="flex items-start gap-3 text-xs">
                        <span
                          className={`mt-1 h-2 w-2 rounded-full ${
                            done ? "bg-emerald-400" : "bg-white/20"
                          }`}
                        />
                        <div>
                          <span className={done ? "text-emerald-200" : "text-zinc-400"}>
                            {t(`timeline.${stepKey}`)}
                          </span>
                          {event.createdAt && (
                            <p className="text-[11px] text-zinc-500">
                              {new Date(event.createdAt).toLocaleString(locale)}
                            </p>
                          )}
                          {event.note && (
                            <p className="text-[11px] text-zinc-500">{event.note}</p>
                          )}
                          {event.proofUrl && (
                            <p className="text-[11px] text-emerald-300">
                              {t("labels.proof")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {order.status === "CANCELED" && (
                    <p className="text-xs text-rose-300">{t("status.canceled")}</p>
                  )}
                  {order.status === "REFUNDED" && (
                    <p className="text-xs text-amber-300">{t("status.refunded")}</p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                  <p className="text-xs text-zinc-400">{t("labels.shipping")}</p>
                  <p className="mt-2 text-xs text-zinc-200">
                    {order.shippingAddress || t("labels.shippingEmpty")}
                  </p>
                  {order.shippingCity && (
                    <p className="text-xs text-zinc-400">{order.shippingCity}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                  <p className="text-xs text-zinc-400">{t("labels.products")}</p>
                  <ul className="mt-2 grid gap-2 text-xs text-zinc-200">
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
                            <p className="truncate">
                              {item.product?.title ?? t("labels.unknown")}
                            </p>
                            {optionParts.length > 0 && (
                              <p className="mt-0.5 text-[11px] text-zinc-500">
                                {optionParts.join(" · ")}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-zinc-400">x{item.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}



