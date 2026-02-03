"use client";

import { useCart } from "./CartProvider";

type AddToCartButtonProps = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  type: "PREORDER" | "DROPSHIP";
  sellerName?: string;
  label: string;
};

export default function AddToCartButton({
  id,
  slug,
  title,
  priceCents,
  currency,
  type,
  sellerName,
  label,
}: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() =>
        addItem({
          id,
          slug,
          title,
          priceCents,
          currency,
          type,
          sellerName,
        })
      }
      className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
    >
      {label}
    </button>
  );
}
