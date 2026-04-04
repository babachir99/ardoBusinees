"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import SponsoredPlacement, { sendSponsoredDismissEvent } from "@/components/ads/SponsoredPlacement";
import {
  filterHomePromosForPlacement,
  type HomePromoEntry,
} from "@/lib/homePromos.shared";

const POPUP_DISMISS_STORAGE_KEY = "jontaado_home_promos_dismissed_until";
const POPUP_REOPEN_DELAY_MS = 1000 * 60 * 60 * 8;

type HomePromoPopupsProps = {
  locale: string;
  promos: HomePromoEntry[];
  isLoggedIn: boolean;
};

export default function HomePromoPopups({ locale, promos, isLoggedIn }: HomePromoPopupsProps) {
  const isFr = locale === "fr";
  const pathname = usePathname() ?? "/";
  const activePromos = useMemo(
    () =>
      filterHomePromosForPlacement(promos, { placement: "HOME_POPUP", isLoggedIn })
        .map((promo) => ({
          ...promo,
          tag: promo.tag || (isFr ? "A la une" : "Spotlight"),
          cta: promo.cta || (isFr ? "Ouvrir" : "Open"),
        })),
    [isFr, isLoggedIn, promos]
  );

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activePromos.length === 0) {
      return;
    }

    try {
      const dismissedUntil = Number(window.localStorage.getItem(POPUP_DISMISS_STORAGE_KEY) ?? "0");
      if (dismissedUntil > Date.now()) {
        return;
      }
    } catch {
      // ignore localStorage read issues
    }

    const timeoutId = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [activePromos.length]);

  useEffect(() => {
    if (!open || activePromos.length <= 1) {
      return;
    }

    const activePromo = activePromos[activeIndex % activePromos.length];
    const intervalId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % activePromos.length);
    }, Math.max(3000, (activePromo?.rotationSeconds ?? 6) * 1000));

    return () => window.clearTimeout(intervalId);
  }, [activeIndex, activePromos, open]);

  const close = () => {
    if (activePromos.length > 0) {
      sendSponsoredDismissEvent({
        promo: activePromos[activeIndex % activePromos.length],
        locale,
        pathname,
      });
    }

    try {
      window.localStorage.setItem(
        POPUP_DISMISS_STORAGE_KEY,
        String(Date.now() + POPUP_REOPEN_DELAY_MS)
      );
    } catch {
      // ignore localStorage write issues
    }

    setOpen(false);
  };

  if (!open || activePromos.length === 0) {
    return null;
  }

  const activePromo = activePromos[activeIndex % activePromos.length];

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end">
      <aside
        className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-[1.7rem] border bg-gradient-to-br ${activePromo.accentClassName} shadow-[0_24px_80px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl`}
      >
        <div className="p-5">
          <div className="flex items-start justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:border-white/20 hover:bg-white/10"
              aria-label={isFr ? "Fermer la promotion" : "Close promotion"}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="-mt-1">
            <SponsoredPlacement
              locale={locale}
              promo={activePromo}
              variant="popup"
            />
          </div>

          <div className="mt-5 flex items-center justify-start gap-3">
            <div className="flex items-center gap-1.5">
              {activePromos.map((promo, index) => (
                <button
                  key={promo.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === activeIndex ? "w-6 bg-emerald-300" : "w-2.5 bg-white/20 hover:bg-white/35"
                  }`}
                  aria-label={`${isFr ? "Voir la promotion" : "View promo"} ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
