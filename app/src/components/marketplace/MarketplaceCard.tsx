"use client";

import type { ReactNode } from "react";

type MarketplaceCardProps = {
  label?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

export default function MarketplaceCard({
  label,
  title,
  description,
  children,
  className,
}: MarketplaceCardProps) {
  return (
    <article
      className={
        className ??
        "rounded-[1.6rem] border border-white/10 bg-zinc-900/60 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-emerald-300/30 hover:shadow-[0_20px_60px_-32px_rgba(16,185,129,0.45)] motion-reduce:transition-none"
      }
    >
      {label ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      ) : null}
      {title ? <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3> : null}
      {description ? <p className="mt-3 text-sm leading-7 text-zinc-400">{description}</p> : null}
      {children ? <div className={title || description ? "mt-4" : ""}>{children}</div> : null}
    </article>
  );
}
