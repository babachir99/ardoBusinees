"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

type AddToCartButtonProps = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  sellerName?: string;
  quantity?: number;
  optionColor?: string;
  optionSize?: string;
  maxQuantity?: number;
  label: string;
  addedLabel?: string;
  className?: string;
};

export default function AddToCartButton({
  id,
  slug,
  title,
  priceCents,
  currency,
  type,
  sellerName,
  quantity = 1,
  optionColor,
  optionSize,
  maxQuantity,
  label,
  addedLabel = "Added",
  className = "rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    addItem(
      {
        id,
        slug,
        title,
        priceCents,
        currency,
        type,
        sellerName,
        optionColor,
        optionSize,
        maxQuantity,
      },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {added ? addedLabel : label}
    </button>
  );
}
