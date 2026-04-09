"use client";

import type { ReactNode } from "react";

export const marketplaceActionPrimaryClass =
  "inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-emerald-300";

export const marketplaceActionSecondaryClass =
  "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10";

type MarketplaceActionsProps = {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
};

export default function MarketplaceActions({
  left,
  right,
  className,
}: MarketplaceActionsProps) {
  return (
    <section
      className={
        className ??
        "sticky top-[92px] z-30 rounded-[1.6rem] border border-white/10 bg-zinc-950/72 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max items-center gap-2">{left}</div>
        </div>
        {right ? <div className="flex flex-wrap items-center justify-end gap-2">{right}</div> : null}
      </div>
    </section>
  );
}
