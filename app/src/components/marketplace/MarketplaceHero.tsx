"use client";

import type { ReactNode } from "react";

type MarketplaceHeroProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  highlights?: string[];
  highlightStyle?: "cards" | "pills";
  metrics?: Array<{ value: string; label: string }>;
  aside?: ReactNode;
  accentClassName?: string;
  compact?: boolean;
};

export default function MarketplaceHero({
  badge,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  highlights = [],
  highlightStyle = "cards",
  metrics = [],
  aside,
  accentClassName = "from-emerald-500/18 via-zinc-950/90 to-zinc-950",
  compact = false,
}: MarketplaceHeroProps) {
  return (
    <section
      className={`overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${accentClassName} ${
        compact ? "px-5 py-5 md:px-6 md:py-5" : "p-6 md:p-8"
      } shadow-[0_24px_80px_-48px_rgba(16,185,129,0.45)] transition-all duration-200 ease-out motion-reduce:transition-none`}
    >
      <div className={`grid ${compact ? "gap-4" : "gap-6"} ${aside ? "xl:grid-cols-[minmax(0,1.08fr)_360px]" : ""}`}>
        <div className="animate-[fadeIn_0.45s_ease]">
          {badge ? (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
              {badge}
            </span>
          ) : null}
          <h1 className={`${badge ? (compact ? "mt-3" : "mt-4") : ""} text-3xl font-bold leading-tight text-white ${compact ? "md:text-3xl" : "md:text-4xl"}`}>
            {title}
          </h1>
          {subtitle ? (
            <p className={`${compact ? "mt-2 max-w-2xl text-sm leading-6" : "mt-3 max-w-3xl text-sm leading-7 md:text-base"} text-zinc-400`}>
              {subtitle}
            </p>
          ) : null}

          {(primaryAction || secondaryAction) && (
            <div className={`${compact ? "mt-3" : "mt-6"} flex flex-wrap items-center gap-3`}>
              {primaryAction}
              {secondaryAction}
            </div>
          )}

          {highlights.length > 0 && (
            highlightStyle === "pills" ? (
              <div className={`${compact ? "mt-3" : "mt-6"} flex flex-wrap gap-2`}>
                {highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300/25 hover:bg-white/10 motion-reduce:transition-none"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-emerald-300/30 hover:shadow-[0_18px_40px_-32px_rgba(16,185,129,0.45)] motion-reduce:transition-none"
                  >
                    {highlight}
                  </div>
                ))}
              </div>
            )
          )}

          {metrics.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-emerald-300/25 hover:shadow-[0_18px_40px_-34px_rgba(16,185,129,0.4)] motion-reduce:transition-none"
                >
                  <p className="text-2xl font-semibold text-white">{metric.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{metric.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {aside ? (
          <div className="animate-[fadeIn_0.55s_ease] rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
