"use client";

/* eslint-disable @next/next/no-img-element */

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import AddToCartButton from "@/components/cart/AddToCartButton";

export type ProductSuggestionItem = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  discountPercent?: number | null;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  stockQuantity?: number | null;
  seller?: { displayName?: string | null; slug?: string | null } | null;
  images: { url: string; alt?: string | null }[];
};

type ProductSuggestionGridProps = {
  title: string;
  subtitle: string;
  products: ProductSuggestionItem[];
  locale: string;
  className?: string;
};

export default function ProductSuggestionGrid({
  title,
  subtitle,
  products,
  locale,
  className = "rounded-2xl border border-white/10 bg-zinc-950/50 p-4",
}: ProductSuggestionGridProps) {
  if (products.length === 0) return null;

  const isFr = locale === "fr";
  const soldOutLabel = isFr ? "Epuise" : "Sold out";
  const lowStockBadge = isFr ? "Stock faible" : "Low stock";
  const soldOutHint = isFr
    ? "Ce produit est momentanement epuise. Reviens un peu plus tard ou essaie une autre suggestion."
    : "This product is temporarily sold out. Check back later or try another suggestion.";
  const lowStockHint = (count: number) =>
    isFr ? `Plus que ${count} article(s) disponible(s).` : `Only ${count} item(s) left.`;

  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const discountedPrice =
            product.discountPercent && product.discountPercent > 0
              ? Math.round((product.priceCents * (100 - product.discountPercent)) / 100)
              : product.priceCents;
          const localStock =
            product.type === "LOCAL"
              ? Math.max(0, Math.floor(Number(product.stockQuantity ?? 0)))
              : undefined;
          const maxQuantity =
            product.type === "LOCAL" && (localStock ?? 0) > 0 ? localStock : undefined;
          const isSoldOut = product.type === "LOCAL" && (localStock ?? 0) <= 0;
          const isLowStock =
            product.type === "LOCAL" && (localStock ?? 0) > 0 && (localStock ?? 0) <= 3;

          return (
            <div
              key={product.id}
              className="group rounded-2xl border border-white/10 bg-zinc-900/70 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/55"
            >
              <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
                <FavoriteButton
                  productId={product.id}
                  variant="icon"
                  className="absolute left-2 top-2 z-20"
                />
                <Link href={`/shop/${product.slug}`} className="block h-full">
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt ?? product.title}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                      Image
                    </div>
                  )}
                </Link>
              </div>

              <Link href={`/shop/${product.slug}`} className="block">
                <div className="mt-3 flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-semibold text-white">
                    {product.title}
                  </p>
                  {isSoldOut ? (
                    <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                      {soldOutLabel}
                    </span>
                  ) : isLowStock ? (
                    <span className="shrink-0 rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200">
                      {lowStockBadge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {product.seller?.displayName ?? "-"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatMoney(discountedPrice, product.currency, locale)}
                  </span>
                  {product.discountPercent && product.discountPercent > 0 ? (
                    <span className="text-[11px] text-zinc-500 line-through">
                      {formatMoney(product.priceCents, product.currency, locale)}
                    </span>
                  ) : null}
                </div>
              </Link>

              <div className="mt-3">
                <AddToCartButton
                  id={product.id}
                  slug={product.slug}
                  title={product.title}
                  priceCents={discountedPrice}
                  currency={product.currency}
                  type={product.type}
                  sellerName={product.seller?.displayName ?? undefined}
                  maxQuantity={maxQuantity}
                  label={isFr ? "Ajouter au panier" : "Add to cart"}
                  addedLabel={isFr ? "Ajoute" : "Added"}
                  soldOutLabel={soldOutLabel}
                  checkingLabel={isFr ? "Verification..." : "Checking..."}
                  disabled={isSoldOut}
                  className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950 transition hover:bg-emerald-300"
                />
              </div>

              {isSoldOut ? (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-100/80">
                  {soldOutHint}
                </p>
              ) : isLowStock ? (
                <p className="mt-3 text-[11px] leading-relaxed text-orange-100/80">
                  {lowStockHint(localStock ?? 0)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
