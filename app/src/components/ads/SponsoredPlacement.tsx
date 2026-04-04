"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useEffect, useMemo, useRef } from "react";
import type { HomePromoEntry } from "@/lib/homePromos.shared";

const PROMO_VISITOR_STORAGE_KEY = "jontaado_promo_visitor_id";

type SponsoredPlacementProps = {
  locale: string;
  promo: HomePromoEntry;
  variant: "popup" | "inline" | "product-card";
  className?: string;
  trackEvents?: boolean;
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function getPromoVisitorId() {
  try {
    const existing = window.localStorage.getItem(PROMO_VISITOR_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `promo-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(PROMO_VISITOR_STORAGE_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}

function trackPromoEvent(payload: {
  campaignId: string;
  eventType: "IMPRESSION" | "CLICK" | "DISMISS";
  placement: HomePromoEntry["placement"];
  advertiserName: string;
  href: string;
  locale: string;
  pathname: string;
  visitorId: string | null;
}) {
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/ads/track", blob);
      return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch("/api/ads/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => null);
}

export function sendSponsoredDismissEvent(params: {
  promo: HomePromoEntry;
  locale: string;
  pathname: string;
}) {
  trackPromoEvent({
    campaignId: params.promo.id,
    eventType: "DISMISS",
    placement: params.promo.placement,
    advertiserName: params.promo.advertiserName,
    href: params.promo.href,
    locale: params.locale,
    pathname: params.pathname,
    visitorId: getPromoVisitorId(),
  });
}

export default function SponsoredPlacement({
  locale,
  promo,
  variant,
  className = "",
  trackEvents = true,
}: SponsoredPlacementProps) {
  const isFr = locale === "fr";
  const pathname = usePathname() ?? "/";
  const lastImpressionCampaignId = useRef<string | null>(null);
  const external = useMemo(() => isExternalHref(promo.href), [promo.href]);
  const visitorId = useMemo(() => getPromoVisitorId(), []);

  useEffect(() => {
    if (!trackEvents) {
      return;
    }

    if (lastImpressionCampaignId.current === promo.id) {
      return;
    }

    lastImpressionCampaignId.current = promo.id;
    trackPromoEvent({
      campaignId: promo.id,
      eventType: "IMPRESSION",
      placement: promo.placement,
      advertiserName: promo.advertiserName,
      href: promo.href,
      locale,
      pathname,
      visitorId,
    });
  }, [locale, pathname, promo.advertiserName, promo.href, promo.id, promo.placement, trackEvents, visitorId]);

  const handleClick = () => {
    if (!trackEvents) {
      return;
    }

    trackPromoEvent({
      campaignId: promo.id,
      eventType: "CLICK",
      placement: promo.placement,
      advertiserName: promo.advertiserName,
      href: promo.href,
      locale,
      pathname,
      visitorId,
    });
  };

  const ctaClasses =
    variant === "popup"
      ? "inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:scale-[1.02] hover:bg-emerald-300"
      : variant === "product-card"
      ? "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/15"
      : "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/15";

  const metaLine = (
    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-200/85">
      <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 font-semibold">
        {promo.sponsoredLabel}
      </span>
      <span className="text-zinc-300/80">{promo.advertiserName}</span>
    </div>
  );

  return (
    <article
      className={`${className} ${variant === "inline" ? `overflow-hidden rounded-[1.7rem] border bg-gradient-to-br ${promo.accentClassName} shadow-[0_22px_60px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl` : ""}`}
    >
      {variant === "inline" ? (
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            {promo.advertiserLogoUrl ? (
              <div className="relative mt-0.5 hidden h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-black/15 md:block">
                <Image
                  src={promo.advertiserLogoUrl}
                  alt={promo.advertiserName}
                  fill
                  sizes="48px"
                  className="object-contain p-2"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {metaLine}
              <h3 className="mt-3 text-lg font-semibold text-white md:text-xl">{promo.title}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                {promo.description}
              </p>
            </div>
          </div>

          {promo.imageUrl ? (
            <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/10 md:w-52">
              <Image
                src={promo.imageUrl}
                alt={promo.title}
                fill
                sizes="(max-width: 768px) 100vw, 208px"
                className="object-contain p-3"
              />
            </div>
          ) : null}

          {external ? (
            <a
              href={promo.href}
              target={promo.openInNewTab ? "_blank" : undefined}
              rel={promo.openInNewTab ? "noreferrer noopener" : undefined}
              className={`${ctaClasses} self-start md:self-center`}
              onClick={handleClick}
            >
              {promo.cta}
              <span aria-hidden="true">&rarr;</span>
            </a>
          ) : (
            <Link href={promo.href} className={`${ctaClasses} self-start md:self-center`} onClick={handleClick}>
              {promo.cta}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      ) : variant === "product-card" ? (
        <div
          className={`h-full rounded-3xl border bg-gradient-to-br ${promo.accentClassName} p-5 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.6)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_20px_44px_-26px_rgba(16,185,129,0.2)]`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-100/90">
                  <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 font-semibold">
                    {promo.sponsoredLabel}
                  </span>
                  <span className="truncate text-zinc-200/80">{promo.advertiserName}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-white">{promo.title}</h3>
              </div>
              {promo.advertiserLogoUrl ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/15">
                  <Image
                    src={promo.advertiserLogoUrl}
                    alt={promo.advertiserName}
                    fill
                    sizes="40px"
                    className="object-contain p-2"
                  />
                </div>
              ) : null}
            </div>

            {promo.imageUrl ? (
              <div className="relative mt-4 h-32 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                <Image
                  src={promo.imageUrl}
                  alt={promo.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="object-contain p-3"
                />
              </div>
            ) : null}

            <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-200/85">{promo.description}</p>

            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
              <div className="text-xs text-zinc-300/70">
                {promo.openInNewTab ? (isFr ? "Externe" : "External") : "JONTAADO"}
              </div>
              {external ? (
                <a
                  href={promo.href}
                  target={promo.openInNewTab ? "_blank" : undefined}
                  rel={promo.openInNewTab ? "noreferrer noopener" : undefined}
                  className={ctaClasses}
                  onClick={handleClick}
                >
                  {promo.cta}
                  <span aria-hidden="true">&rarr;</span>
                </a>
              ) : (
                <Link href={promo.href} className={ctaClasses} onClick={handleClick}>
                  {promo.cta}
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="min-w-0 flex-1">
            {metaLine}
            <h3 className="mt-3 text-lg font-semibold text-white">{promo.title}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{promo.description}</p>
          </div>
          {promo.imageUrl ? (
            <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/10">
              <Image
                src={promo.imageUrl}
                alt={promo.title}
                fill
                sizes="320px"
                className="object-contain p-3"
              />
            </div>
          ) : null}
          <div className="flex items-center justify-end">
            {external ? (
              <a
                href={promo.href}
                target={promo.openInNewTab ? "_blank" : undefined}
                rel={promo.openInNewTab ? "noreferrer noopener" : undefined}
                className={ctaClasses}
                onClick={handleClick}
              >
                {promo.cta}
                <span aria-hidden="true">&rarr;</span>
              </a>
            ) : (
              <Link href={promo.href} className={ctaClasses} onClick={handleClick}>
                {promo.cta}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
