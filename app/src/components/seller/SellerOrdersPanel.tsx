"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  items: { id: string; quantity: number }[];
};

export default function SellerOrdersPanel() {
  const t = useTranslations("SellerSpace");
  const locale = useLocale();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders?take=50");
      if (!res.ok) {
        throw new Error(t("errors.loadOrders"));
      }
      const data = (await res.json()) as Order[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadOrders"));
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
      <h1 className="text-2xl font-semibold">{t("orders.title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("orders.subtitle")}</p>

      {items.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("orders.empty")}</p>
      )}

      {items.length > 0 && (
        <div className="mt-6 grid gap-3">
          {items.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-950/60 px-5 py-4 text-xs text-zinc-300"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {t("orders.order")} #{order.id.slice(0, 8)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {new Date(order.createdAt).toLocaleString(locale)}
                </p>
                <p className="mt-1 text-[11px]">
                  {order.buyerName ?? order.buyerEmail ?? t("orders.unknown")}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase">
                  {t(`orders.status.${order.status.toLowerCase()}`)}
                </span>
                <p className="mt-2 text-sm text-emerald-200">
                  {formatMoney(order.totalCents, order.currency, locale)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {t("orders.items", { count: order.items.length })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
