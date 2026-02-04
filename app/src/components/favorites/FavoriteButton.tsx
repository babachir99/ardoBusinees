"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function FavoriteButton({ productId }: { productId: string }) {
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
      className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold transition hover:border-white/40 disabled:opacity-60"
    >
      {isFavorite ? t("remove") : t("add")}
    </button>
  );
}
