"use client";

import { useEffect, useMemo, useState, type TouchEvent } from "react";
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
  stockQuantity?: number | null;
  images: ProductImage[];
  addLabel: string;
  addedLabel: string;
  showColorOptions: boolean;
  showSizeOptions: boolean;
  colorOptions?: string[];
  sizeOptions?: string[];
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
  stockQuantity,
  images,
  addLabel,
  addedLabel,
  showColorOptions,
  showSizeOptions,
  colorOptions,
  sizeOptions,
}: ProductPurchasePanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const resolvedColorOptions = useMemo(() => {
    const normalized = (colorOptions ?? [])
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
      .slice(0, 20);

    if (normalized.length > 0) return normalized;
    if (!showColorOptions) return [];

    return locale === "fr"
      ? ["Noir", "Blanc", "Bleu", "Rouge", "Vert"]
      : ["Black", "White", "Blue", "Red", "Green"];
  }, [colorOptions, locale, showColorOptions]);

  const resolvedSizeOptions = useMemo(() => {
    const normalized = (sizeOptions ?? [])
      .map((value) => String(value).trim().toUpperCase())
      .filter((value) => value.length > 0)
      .slice(0, 20);

    if (normalized.length > 0) return normalized;
    if (!showSizeOptions) return [];

    return ["S", "M", "L", "XL", "XXL"];
  }, [showSizeOptions, sizeOptions]);

  const [selectedColor, setSelectedColor] = useState(() => resolvedColorOptions[0] ?? "");
  const [selectedSize, setSelectedSize] = useState(() => resolvedSizeOptions[0] ?? "");
  const effectiveSelectedColor = resolvedColorOptions.includes(selectedColor)
    ? selectedColor
    : (resolvedColorOptions[0] ?? "");
  const effectiveSelectedSize = resolvedSizeOptions.includes(selectedSize)
    ? selectedSize
    : (resolvedSizeOptions[0] ?? "");

  const safeImages = images.filter((image) => Boolean(image.url));
  const hasImages = safeImages.length > 0;

  const isLocalSoldOut =
    type === "LOCAL" && Number.isFinite(stockQuantity) && Number(stockQuantity) <= 0;
  const stockLimit =
    type === "LOCAL" && Number.isFinite(stockQuantity) && Number(stockQuantity) > 0
      ? Math.floor(Number(stockQuantity))
      : undefined;
  const maxSelectableQuantity = isLocalSoldOut ? 0 : stockLimit ?? 99;
  const canAddToCart = maxSelectableQuantity > 0;

  useEffect(() => {
    if (safeImages.length <= 1 || isLightboxOpen) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((idx) => (idx + 1) % safeImages.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [safeImages.length, isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false);
        setIsZoomed(false);
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((idx) => (idx - 1 + safeImages.length) % safeImages.length);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((idx) => (idx + 1) % safeImages.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLightboxOpen, safeImages.length]);

  const normalizedIndex = safeImages.length > 0 ? activeIndex % safeImages.length : 0;
  const currentImage = hasImages ? safeImages[normalizedIndex] : null;
  const favoriteAddLabel = locale === "fr" ? "Ajouter aux favoris" : "Add to favorites";
  const favoriteRemoveLabel = locale === "fr" ? "Retirer des favoris" : "Remove from favorites";
  const soldOutLabel = locale === "fr" ? "Epuise" : "Sold out";
  const checkingLabel = locale === "fr" ? "Verification..." : "Checking...";

  const nextImage = () => {
    if (safeImages.length <= 1) return;
    setActiveIndex((idx) => (idx + 1) % safeImages.length);
  };

  const prevImage = () => {
    if (safeImages.length <= 1) return;
    setActiveIndex((idx) => (idx - 1 + safeImages.length) % safeImages.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchStartX === null || safeImages.length <= 1) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;

    if (Math.abs(delta) >= 35) {
      if (delta < 0) nextImage();
      else prevImage();
    }

    setTouchStartX(null);
  };

  return (
    <>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <div
            className="relative flex h-[360px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {currentImage ? (
              <img
                src={currentImage.url}
                alt={currentImage.alt ?? title}
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => setIsLightboxOpen(true)}
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
                  aria-label={locale === "fr" ? "Image precedente" : "Previous image"}
                  className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-zinc-950/75 text-sm font-semibold text-white transition hover:border-emerald-300/60"
                >
                  &#8249;
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  aria-label={locale === "fr" ? "Image suivante" : "Next image"}
                  className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-zinc-950/75 text-sm font-semibold text-white transition hover:border-emerald-300/60"
                >
                  &#8250;
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-zinc-950/75 px-2 py-1 text-[11px] text-zinc-300">
                  {normalizedIndex + 1}/{safeImages.length}
                </span>
              </>
            )}
          </div>

          {safeImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {safeImages.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition ${
                    index === normalizedIndex
                      ? "border-emerald-300/80"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img src={image.url} alt={image.alt ?? title} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] text-zinc-500">
            {locale === "fr"
              ? "Defilement auto actif. Clique pour plein ecran, glisse pour naviguer."
              : "Auto slideshow enabled. Click for fullscreen, swipe to browse."}
          </p>
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
                  disabled={!canAddToCart || quantity <= 1}
                  className="h-8 w-8 rounded-full border border-white/20 text-lg leading-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  -
                </button>
                <span className="min-w-[28px] text-center text-sm font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxSelectableQuantity, q + 1))}
                  disabled={!canAddToCart || quantity >= maxSelectableQuantity}
                  className="h-8 w-8 rounded-full border border-white/20 text-lg leading-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
              {isLocalSoldOut ? (
                <p className="mt-2 text-[11px] text-rose-300">
                  {locale === "fr" ? "Produit epuise" : "Product sold out"}
                </p>
              ) : (
                stockLimit && (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {locale === "fr" ? `Stock max: ${stockLimit}` : `Max stock: ${stockLimit}`}
                  </p>
                )
              )}
            </div>

            {showColorOptions && (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  {locale === "fr" ? "Couleur" : "Color"}
                </p>
                <select
                  value={effectiveSelectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                >
                  {resolvedColorOptions.map((color) => (
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
                  value={effectiveSelectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                >
                  {resolvedSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {((showColorOptions && Boolean(effectiveSelectedColor)) || (showSizeOptions && Boolean(effectiveSelectedSize))) && (
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                {showColorOptions && <span>{locale === "fr" ? "Couleur" : "Color"}: {effectiveSelectedColor}</span>}
                {showColorOptions && showSizeOptions && <span className="px-2 text-zinc-500">-</span>}
                {showSizeOptions && <span>{locale === "fr" ? "Taille" : "Size"}: {effectiveSelectedSize}</span>}
              </div>
            )}

            <div id="purchase-actions" className="mt-1 grid gap-3">
              <AddToCartButton
                id={productId}
                slug={slug}
                disabled={!canAddToCart}
                title={title}
                priceCents={priceCents}
                soldOutLabel={soldOutLabel}
                checkingLabel={checkingLabel}
                currency={currency}
                type={type}
                sellerName={sellerName}
                quantity={quantity}
                optionColor={showColorOptions ? effectiveSelectedColor || undefined : undefined}
                optionSize={showSizeOptions ? effectiveSelectedSize || undefined : undefined}
                maxQuantity={maxSelectableQuantity}
                label={addLabel}
                addedLabel={addedLabel}
                className="w-full whitespace-nowrap rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950"
              />

              <FavoriteButton
                productId={productId}
                addLabel={favoriteAddLabel}
                removeLabel={favoriteRemoveLabel}
                className="w-full whitespace-nowrap rounded-xl border-white/20 bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-100"
              />
            </div>
          </div>
        </div>
      </div>

      {isLightboxOpen && currentImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 p-3 md:p-6"
          onClick={() => {
            setIsLightboxOpen(false);
            setIsZoomed(false);
          }}
        >
          <div
            className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl border border-white/15 bg-zinc-950/95"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm text-zinc-300">
                {normalizedIndex + 1}/{safeImages.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsZoomed((value) => !value)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
                >
                  {isZoomed ? "Zoom -" : "Zoom +"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLightboxOpen(false);
                    setIsZoomed(false);
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
                >
                  {locale === "fr" ? "Fermer" : "Close"}
                </button>
              </div>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={currentImage.url}
                alt={currentImage.alt ?? title}
                className={`max-h-full max-w-full object-contain transition duration-200 ${
                  isZoomed ? "scale-125 cursor-zoom-out" : "scale-100 cursor-zoom-in"
                }`}
                onClick={() => setIsZoomed((value) => !value)}
              />

              {safeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-zinc-900/75 text-white"
                    aria-label={locale === "fr" ? "Image precedente" : "Previous image"}
                  >
                    &#8249;
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-zinc-900/75 text-white"
                    aria-label={locale === "fr" ? "Image suivante" : "Next image"}
                  >
                    &#8250;
                  </button>
                </>
              )}
            </div>

            {safeImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-3">
                {safeImages.map((image, index) => (
                  <button
                    key={`${image.url}-modal-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition ${
                      index === normalizedIndex
                        ? "border-emerald-300/80"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <img src={image.url} alt={image.alt ?? title} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
