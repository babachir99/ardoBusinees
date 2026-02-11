"use client";

import { useEffect, useState, type TouchEvent } from "react";

type ProductCardImage = {
  url: string;
  alt?: string | null;
};

type ProductCardCarouselProps = {
  images: ProductCardImage[];
  title: string;
  locale: string;
  className?: string;
};

export default function ProductCardCarousel({
  images,
  title,
  locale,
  className,
}: ProductCardCarouselProps) {
  const safeImages = images.filter((image) => Boolean(image.url));
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (safeImages.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((idx) => (idx + 1) % safeImages.length);
    }, 3800);

    return () => window.clearInterval(intervalId);
  }, [safeImages.length]);

  const onPrev = () => {
    if (safeImages.length <= 1) return;
    setActiveIndex((idx) => (idx - 1 + safeImages.length) % safeImages.length);
  };

  const onNext = () => {
    if (safeImages.length <= 1) return;
    setActiveIndex((idx) => (idx + 1) % safeImages.length);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || safeImages.length <= 1) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;

    if (Math.abs(delta) >= 30) {
      if (delta < 0) onNext();
      else onPrev();
    }

    setTouchStartX(null);
  };

  if (safeImages.length === 0) {
    return (
      <div className={`flex h-full w-full items-center justify-center text-xs text-zinc-500 ${className ?? ""}`}>
        {locale === "fr" ? "Image a venir" : "Image coming soon"}
      </div>
    );
  }

  const normalizedIndex = safeImages.length > 0 ? activeIndex % safeImages.length : 0;
  const currentImage = safeImages[normalizedIndex];

  return (
    <div
      className={`relative h-full w-full ${className ?? ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={currentImage.url}
        alt={currentImage.alt ?? title}
        className="h-full w-full object-cover"
      />

      {safeImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPrev();
            }}
            aria-label={locale === "fr" ? "Image precedente" : "Previous image"}
            className="absolute left-2 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-zinc-950/75 text-sm font-semibold text-white transition hover:border-emerald-300/60"
          >
            &#8249;
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onNext();
            }}
            aria-label={locale === "fr" ? "Image suivante" : "Next image"}
            className="absolute right-2 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-zinc-950/75 text-sm font-semibold text-white transition hover:border-emerald-300/60"
          >
            &#8250;
          </button>
          <span className="absolute bottom-2 right-2 rounded-full bg-zinc-950/75 px-2 py-0.5 text-[10px] text-zinc-300">
            {normalizedIndex + 1}/{safeImages.length}
          </span>
        </>
      )}
    </div>
  );
}



