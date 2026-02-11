"use client";

import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";

type CartHeaderButtonProps = {
  label?: string;
};

export default function CartHeaderButton({ label = "Cart" }: CartHeaderButtonProps) {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900/70 text-zinc-100 transition hover:border-white/50"
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
      >
        <path d="M3 5h2l2.2 10.5a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="19" r="1.2" />
        <circle cx="17" cy="19" r="1.2" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-emerald-400 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-zinc-950">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
