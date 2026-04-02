"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney, getDiscountedPrice } from "@/lib/format";

type Favorite = {
  id: string;
  productId: string;
  product: {
    id: string;
    title: string;
    priceCents: number;
    discountPercent?: number | null;
    currency: string;
    slug: string;
    images: { url: string; alt?: string | null }[];
    seller?: { displayName?: string | null } | null;
  };
};

export default function FavoritesList() {
  const t = useTranslations("Favorites");
  const locale = useLocale();
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Favorite[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (productId: string) => {
    await fetch(`/api/favorites?productId=${productId}`, { method: "DELETE" });
    load();
  };

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

      {items.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>
      )}

      {items.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((fav) => (
            <div
              key={fav.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900">
                {fav.product.images?.[0]?.url ? (
                  <img
                    src={fav.product.images[0].url}
                    alt={fav.product.images[0].alt ?? fav.product.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">
                {fav.product.title}
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                {fav.product.seller?.displayName ?? t("unknownSeller")}
              </p>
              <p className="mt-2 text-sm text-emerald-200">
                {fav.product.discountPercent ? (
                  <>
                    {formatMoney(
                      getDiscountedPrice(
                        fav.product.priceCents,
                        fav.product.discountPercent
                      ),
                      fav.product.currency,
                      locale
                    )}
                  </>
                ) : (
                  formatMoney(
                    fav.product.priceCents,
                    fav.product.currency,
                    locale
                  )
                )}
              </p>
              <button
                type="button"
                onClick={() => remove(fav.productId)}
                className="mt-3 rounded-full border border-white/20 px-4 py-2 text-[11px] text-white transition hover:border-white/40"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
