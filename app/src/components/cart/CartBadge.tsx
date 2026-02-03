"use client";

import { useCart } from "./CartProvider";

export default function CartBadge() {
  const { count } = useCart();

  if (count === 0) {
    return null;
  }

  return (
    <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-semibold text-zinc-950">
      {count}
    </span>
  );
}
