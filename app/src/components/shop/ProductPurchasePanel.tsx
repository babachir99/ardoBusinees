"use client";

import { useMemo, useState } from "react";
import AddToCartButton from "@/components/cart/AddToCartButton";
import FavoriteButton from "@/components/favorites/FavoriteButton";

type ProductImage = {
  url: string;
  alt?: string | null;
};

type ProductPurchasePanelProps = {
  locale: string;
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  sellerName?: string;
  images: ProductImage[];
  addLabel: string;
  addedLabel: string;
  showColorOptions: boolean;
  showSizeOptions: boolean;
};

export default function ProductPurchasePanel({
  locale,
  productId,
  slug,
  title,
  priceCents,
  currency,
  type,
  sellerName,
  images,
  addLabel,
  addedLabel,
  showColorOptions,
  showSizeOptions,
}: ProductPurchasePanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const colorOptions = useMemo(
    () =>
      locale === "fr"
        ? ["Noir", "Blanc", "Bleu", "Rouge", "Vert"]
        : ["Black", "White", "Blue", "Red", "Green"],
    [locale]
  );

  const sizeOptions = useMemo(
    () => ["S", "M", "L", "XL", "XXL"],
    []
  );

  const [selectedColor, setSelectedColor] = useState(colorOptions[0] ?? "");
  const [selectedSize, setSelectedSize] = useState(sizeOptions[2] ?? sizeOptions[0] ?? "");

  const safeImages = images.filter((image) => Boolean(image.url));
  const hasImages = safeImages.length > 0;
  const currentImage = hasImages ? safeImages[activeIndex] : null;

  const nextImage = () => {
    if (!hasImages) return;
    setActiveIndex((idx) => (idx + 1) % safeImages.length);
  };

  const prevImage = () => {
    if (!hasImages) return;
    setActiveIndex((idx) => (idx - 1 + safeImages.length) % safeImages.length);
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
        <div className="relative flex h-80 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
          {currentImage ? (
            <img
              src={currentImage.url}
              alt={currentImage.alt ?? title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-sm text-zinc-500">
              {locale === "fr" ? "Aucune image disponible" : "No image available"}
            </div>
          )}

          {safeImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-zinc-950/70 px-3 py-1 text-sm text-white"
              >
                �
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-zinc-950/70 px-3 py-1 text-sm text-white"
              >
                �
              </button>
              <span className="absolute bottom-3 right-3 rounded-full bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-300">
                {activeIndex + 1}/{safeImages.length}
              </span>
            </>
          )}
        </div>

        {safeImages.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {safeImages.slice(0, 10).map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`overflow-hidden rounded-lg border ${
                  index === activeIndex ? "border-emerald-300/70" : "border-white/10"
                }`}
              >
                <img src={image.url} alt={image.alt ?? title} className="h-14 w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
        <div className="grid gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              {locale === "fr" ? "Quantite" : "Quantity"}
            </p>
            <div className="mt-2 inline-flex items-center gap-3 rounded-full border border-white/15 bg-zinc-900 px-3 py-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-8 w-8 rounded-full border border-white/20 text-lg leading-none"
              >
                -
              </button>
              <span className="min-w-[28px] text-center text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="h-8 w-8 rounded-full border border-white/20 text-lg leading-none"
              >
                +
              </button>
            </div>
          </div>

          {showColorOptions && (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                {locale === "fr" ? "Couleur" : "Color"}
              </p>
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {colorOptions.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showSizeOptions && (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                {locale === "fr" ? "Taille" : "Size"}
              </p>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {sizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <AddToCartButton
              id={productId}
              slug={slug}
              title={title}
              priceCents={priceCents}
              currency={currency}
              type={type}
              sellerName={sellerName}
              quantity={quantity}
              optionColor={showColorOptions ? selectedColor : undefined}
              optionSize={showSizeOptions ? selectedSize : undefined}
              label={addLabel}
              addedLabel={addedLabel}
              className="w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            />
            <FavoriteButton productId={productId} />
          </div>
        </div>
      </div>
    </div>
  );
}
