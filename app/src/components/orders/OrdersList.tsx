"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: { id: string }[];
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

export default function OrdersList() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders?take=20");
      if (!res.ok) {
        throw new Error(t("errors.generic"));
      }
      const data = (await res.json()) as Order[];
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>

      {orders.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>
      )}

      {orders.length > 0 && (
        <div className="mt-6 grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">{t("labels.order")}</p>
                  <p className="text-sm font-semibold text-white">
                    {order.id.slice(0, 10)}...
                  </p>
                </div>
                <p className="text-xs text-emerald-300">
                  {t(`status.${statusMap[order.status] ?? "pending"}`)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-zinc-300">
                <span>
                  {t("labels.items", { count: order.items.length })}
                </span>
                <span>{formatMoney(order.totalCents, order.currency, locale)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
