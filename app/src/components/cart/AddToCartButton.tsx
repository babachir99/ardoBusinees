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
  disabled?: boolean;
  checkingLabel?: string;
  soldOutLabel?: string;
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
  disabled = false,
  checkingLabel = "...",
  soldOutLabel = "Sold out",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);

  const resolveLiveLocalStock = async (): Promise<number | undefined> => {
    try {
      const response = await fetch(`/api/products/${id}`, { cache: "no-store" });
      if (!response.ok) return maxQuantity;

      const payload = (await response.json()) as {
        isActive?: boolean;
        stockQuantity?: number | null;
      };

      if (payload?.isActive === false) return 0;

      const stockRaw = Number(payload?.stockQuantity);
      if (!Number.isFinite(stockRaw)) return maxQuantity;
      return Math.max(0, Math.floor(stockRaw));
    } catch {
      return maxQuantity;
    }
  };

  const handleClick = async () => {
    if (disabled || isSoldOut || isChecking) return;

    let liveMaxQuantity = maxQuantity;

    if (type === "LOCAL") {
      setIsChecking(true);
      liveMaxQuantity = await resolveLiveLocalStock();
      setIsChecking(false);

      if (liveMaxQuantity !== undefined && liveMaxQuantity <= 0) {
        setIsSoldOut(true);
        return;
      }
    }

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
        maxQuantity: liveMaxQuantity ?? maxQuantity,
      },
      quantity
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  const isDisabled = disabled || isChecking || isSoldOut;
  const text = isSoldOut
    ? soldOutLabel
    : isChecking
    ? checkingLabel
    : added
    ? addedLabel
    : label;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isDisabled}
      className={`${className} ${
        isDisabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {text}
    </button>
  );
}
