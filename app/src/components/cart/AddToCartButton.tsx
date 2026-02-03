"use client";

import { useState } from "react";
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
  addedLabel?: string;
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
  addedLabel = "Added",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    addItem({
      id,
      slug,
      title,
      priceCents,
      currency,
      type,
      sellerName,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
    >
      {added ? addedLabel : label}
    </button>
  );
}
