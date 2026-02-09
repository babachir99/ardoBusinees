"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type FavoriteButtonProps = {
  productId: string;
  addLabel?: string;
  removeLabel?: string;
  className?: string;
};

export default function FavoriteButton({
  productId,
  addLabel,
  removeLabel,
  className,
}: FavoriteButtonProps) {
  const t = useTranslations("Favorites");
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/favorites?productId=${productId}`);
      if (res.ok) {
        const data = (await res.json()) as { isFavorite: boolean };
        setIsFavorite(data.isFavorite);
      }
    };
    load();
  }, [productId]);

  const toggle = async () => {
    setLoading(true);
    if (isFavorite) {
      await fetch(`/api/favorites?productId=${productId}`, { method: "DELETE" });
      setIsFavorite(false);
    } else {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      setIsFavorite(true);
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold transition hover:border-white/40 disabled:opacity-60 ${
        className ?? ""
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${isFavorite ? "fill-current" : "fill-none stroke-current"}`}
      >
        <path
          d="M12 20.25c-4.9-2.7-8-5.6-8-9.25a4.75 4.75 0 0 1 8-3.43A4.75 4.75 0 0 1 20 11c0 3.65-3.1 6.55-8 9.25Z"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{isFavorite ? removeLabel ?? t("remove") : addLabel ?? t("add")}</span>
    </button>
  );
}
