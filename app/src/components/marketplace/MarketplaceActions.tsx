"use client";

import type { ReactNode } from "react";

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
        <div className="flex min-w-0 flex-wrap items-center gap-2">{left}</div>
        {right ? <div className="flex flex-wrap items-center justify-end gap-2">{right}</div> : null}
      </div>
    </section>
  );
}
