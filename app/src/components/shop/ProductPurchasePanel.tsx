"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
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
  shareLabel: string;
  copiedLabel: string;
  shareErrorLabel: string;
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
  shareLabel,
  copiedLabel,
  shareErrorLabel,
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
  const [shareFeedback, setShareFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (shareFeedback === "idle") return;
    const timer = window.setTimeout(() => setShareFeedback("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  useEffect(() => {
    if (!isShareMenuOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!shareMenuRef.current) return;
      if (!shareMenuRef.current.contains(event.target as Node)) {
        setIsShareMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsShareMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isShareMenuOpen]);

  const normalizedIndex = safeImages.length > 0 ? activeIndex % safeImages.length : 0;
  const currentImage = hasImages ? safeImages[normalizedIndex] : null;
  const favoriteAddLabel = locale === "fr" ? "Ajouter aux favoris" : "Add to favorites";
  const favoriteRemoveLabel = locale === "fr" ? "Retirer des favoris" : "Remove from favorites";
  const soldOutLabel = locale === "fr" ? "Epuise" : "Sold out";
  const checkingLabel = locale === "fr" ? "Verification..." : "Checking...";
  const shareTitle = locale === "fr" ? "Partager l'annonce" : "Share listing";
  const shareSubtitle =
    locale === "fr" ? "Copiez ou partagez cette annonce en un clic." : "Copy or share this listing in one click.";
  const closeLabel = locale === "fr" ? "Fermer" : "Close";
  const copyLinkLabel = locale === "fr" ? "Copier le lien" : "Copy link";
  const emailLabel = locale === "fr" ? "E-mail" : "E-mail";
  const facebookLabel = "Facebook";
  const whatsappLabel = "WhatsApp";
  const twitterLabel = "X / Twitter";
  const shareLeadText =
    locale === "fr"
      ? "Nouvelle pépite dispo sur JONTAADO! Regarde ça 👇"
      : "New gem available on JONTAADO! Check this out 👇";

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

  const closeShareMenu = () => setIsShareMenuOpen(false);

  const handleShareToggle = () => {
    setIsShareMenuOpen((open) => !open);
  };

  const buildShareMessage = (url: string) => `${shareLeadText}: ${title} - ${url}`;

  const copyCurrentLink = async () => {
    try {
      const url = window.location.href;
      const message = buildShareMessage(url);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = message;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setShareFeedback("copied");
      closeShareMenu();
    } catch {
      setShareFeedback("error");
    }
  };

  const shareByEmail = () => {
    const url = window.location.href;
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(buildShareMessage(url));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    closeShareMenu();
  };

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    closeShareMenu();
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const quote = encodeURIComponent(`${shareLeadText}: ${title}`);
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`);
  };

  const shareOnWhatsapp = () => {
    const text = encodeURIComponent(buildShareMessage(window.location.href));
    openShareWindow(`https://wa.me/?text=${text}`);
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`${shareLeadText}: ${title}`);
    openShareWindow(`https://twitter.com/intent/tweet?url=${url}&text=${text}`);
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

              <div className="relative" ref={shareMenuRef}>
                <button
                  type="button"
                  onClick={handleShareToggle}
                  className="w-full whitespace-nowrap rounded-xl border border-white/20 bg-zinc-900/70 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-emerald-300/60"
                >
                  {shareLabel}
                </button>

                {isShareMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.45rem)] z-40 w-64 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                      <p className="text-sm font-semibold text-white">{shareTitle}</p>
                      <button
                        type="button"
                        onClick={closeShareMenu}
                        className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-zinc-300 hover:border-white/40"
                        aria-label={closeLabel}
                      >
                        x
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-zinc-400">{shareSubtitle}</p>

                    <div className="grid gap-1.5">
                      <button
                        type="button"
                        onClick={copyCurrentLink}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-zinc-300">
                          <path d="M9 15 6 18a4 4 0 1 1-6-6l3-3" />
                          <path d="m15 9 3-3a4 4 0 1 1 6 6l-3 3" />
                          <path d="m8 16 8-8" />
                        </svg>
                        {copyLinkLabel}
                      </button>
                      <button
                        type="button"
                        onClick={shareByEmail}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-zinc-300">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m4 7 8 6 8-6" />
                        </svg>
                        {emailLabel}
                      </button>
                      <button
                        type="button"
                        onClick={shareOnFacebook}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-zinc-300">
                          <path d="M15 8h3V4h-3a5 5 0 0 0-5 5v3H7v4h3v4h4v-4h3l1-4h-4V9a1 1 0 0 1 1-1Z" />
                        </svg>
                        {facebookLabel}
                      </button>
                      <button
                        type="button"
                        onClick={shareOnWhatsapp}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-zinc-300">
                          <path d="M20 12a8 8 0 0 1-11.7 7l-4.3 1 1-4.2A8 8 0 1 1 20 12Z" />
                          <path d="M9.6 9.8c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .5.4l.6 1.5c.1.3 0 .4-.2.6l-.4.4c-.1.1-.2.2-.1.4.2.5.6 1 1 1.4.5.4 1 .8 1.6 1 .2.1.3 0 .4-.1l.4-.5c.2-.2.4-.3.7-.2l1.4.6c.3.1.4.3.4.5v.5c0 .2 0 .4-.5.6-.5.2-1.1.2-1.8-.1a8.5 8.5 0 0 1-4.7-4.6c-.3-.7-.3-1.3-.1-1.8Z" />
                        </svg>
                        {whatsappLabel}
                      </button>
                      <button
                        type="button"
                        onClick={shareOnTwitter}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-zinc-300">
                          <path d="M4 4 20 20" />
                          <path d="M20 4 4 20" />
                        </svg>
                        {twitterLabel}
                      </button>
                    </div>
                  </div>
                )}

                {shareFeedback === "copied" && (
                  <p className="mt-1 text-[11px] text-emerald-300">{copiedLabel}</p>
                )}
                {shareFeedback === "error" && (
                  <p className="mt-1 text-[11px] text-rose-300">{shareErrorLabel}</p>
                )}
              </div>
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




