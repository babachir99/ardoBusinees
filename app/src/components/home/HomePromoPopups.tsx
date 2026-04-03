"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useMemo, useState } from "react";
import { isHomePromoScheduledLive, type HomePromoEntry } from "@/lib/homePromos";

const POPUP_DISMISS_STORAGE_KEY = "jontaado_home_promos_dismissed_until";
const POPUP_REOPEN_DELAY_MS = 1000 * 60 * 60 * 8;

type HomePromoPopupsProps = {
  locale: string;
  promos: HomePromoEntry[];
};

export default function HomePromoPopups({ locale, promos }: HomePromoPopupsProps) {
  const isFr = locale === "fr";
  const activePromos = useMemo(
    () =>
      promos
        .filter((promo) => isHomePromoScheduledLive(promo))
        .map((promo) => ({
          ...promo,
          tag: promo.tag || (isFr ? "A la une" : "Spotlight"),
          cta: promo.cta || (isFr ? "Ouvrir" : "Open"),
        })),
    [isFr, promos]
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

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % activePromos.length);
    }, 5200);

    return () => window.clearInterval(intervalId);
  }, [activePromos.length, open]);

  const close = () => {
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-100">
                {activePromo.tag}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white">{activePromo.title}</h3>
            </div>
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

          <p className="mt-3 text-sm leading-6 text-zinc-300">{activePromo.description}</p>

          <div className="mt-5 flex items-center justify-between gap-3">
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

            <Link
              href={activePromo.href}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:scale-[1.02] hover:bg-emerald-300"
              onClick={close}
            >
              {activePromo.cta}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
