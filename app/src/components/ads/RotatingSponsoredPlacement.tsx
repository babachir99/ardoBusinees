"use client";

import { useEffect, useMemo, useState } from "react";
import SponsoredPlacement from "@/components/ads/SponsoredPlacement";
import type { HomePromoEntry } from "@/lib/homePromos.shared";

type RotatingSponsoredPlacementProps = {
  locale: string;
  promos: HomePromoEntry[];
  variant: "inline" | "product-card";
  initialIndex?: number;
  className?: string;
};

function getRotationMs(promo: HomePromoEntry | undefined, variant: "inline" | "product-card") {
  const fallback = variant === "inline" ? 8000 : 7000;
  if (!promo?.rotationSeconds) {
    return fallback;
  }
  return Math.max(3000, promo.rotationSeconds * 1000);
}

export default function RotatingSponsoredPlacement({
  locale,
  promos,
  variant,
  initialIndex = 0,
  className,
}: RotatingSponsoredPlacementProps) {
  const activePromos = useMemo(
    () => promos.filter((promo) => promo.enabled),
    [promos]
  );
  const [activeIndex, setActiveIndex] = useState(() =>
    activePromos.length > 0 ? initialIndex % activePromos.length : 0
  );
  const safeActiveIndex = activePromos.length > 0 ? activeIndex % activePromos.length : 0;
  const activePromo =
    activePromos.length > 0 ? activePromos[safeActiveIndex] : null;

  useEffect(() => {
    if (!activePromo || activePromos.length <= 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % activePromos.length);
    }, getRotationMs(activePromo, variant));

    return () => window.clearTimeout(timeoutId);
  }, [activePromo, activePromos.length, safeActiveIndex, variant]);

  if (!activePromo) {
    return null;
  }

  return (
    <div className={className}>
      <SponsoredPlacement
        key={`${variant}-${activePromo.id}`}
        locale={locale}
        promo={activePromo}
        variant={variant}
      />
      {activePromos.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {activePromos.map((promo, index) => (
            <button
              key={promo.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === safeActiveIndex ? "w-5 bg-emerald-300" : "w-2 bg-white/20 hover:bg-white/35"
              }`}
              aria-label={`${promo.title} ${index + 1}`}
              title={promo.title}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
