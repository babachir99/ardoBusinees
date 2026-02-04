"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type SellerProfile = {
  id: string;
  displayName: string;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  isActive: boolean;
  images: { url: string; alt?: string | null }[];
};

export default function SellerProductsPanel() {
  const t = useTranslations("SellerSpace");
  const locale = useLocale();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const sellerRes = await fetch("/api/seller/me");
      if (!sellerRes.ok) {
        throw new Error(t("errors.seller"));
      }
      const sellerData = (await sellerRes.json()) as SellerProfile;
      setSeller(sellerData);

      const productsRes = await fetch(
        `/api/products?sellerId=${sellerData.id}&take=50`
      );
      if (!productsRes.ok) {
        throw new Error(t("errors.loadProducts"));
      }
      const products = (await productsRes.json()) as Product[];
      setItems(products);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadProducts"));
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("products.title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">
            {t("products.subtitle", { name: seller?.displayName ?? "JONTAADO" })}
          </p>
        </div>
        <Link
          href="/seller/products/new"
          className="rounded-full bg-emerald-400 px-5 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("products.cta")}
        </Link>
      </div>

      {items.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("products.empty")}</p>
      )}

      {items.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900">
                {product.images?.[0]?.url ? (
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].alt ?? product.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[10px] text-zinc-100">
                  {t(`products.types.${product.type.toLowerCase()}`)}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">
                {product.title}
              </h3>
              <p className="mt-2 text-sm text-emerald-200">
                {formatMoney(product.priceCents, product.currency, locale)}
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span
                  className={`rounded-full px-3 py-1 ${
                    product.isActive
                      ? "bg-emerald-400/15 text-emerald-200"
                      : "bg-rose-400/15 text-rose-200"
                  }`}
                >
                  {product.isActive
                    ? t("products.active")
                    : t("products.inactive")}
                </span>
                <Link
                  href={`/shop/${product.slug}`}
                  className="text-emerald-200 transition hover:text-emerald-100"
                >
                  {t("products.view")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
