"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

type FavoriteButtonProps = {
  productId: string;
  initialIsFavorite?: boolean;
  addLabel?: string;
  removeLabel?: string;
  variant?: "default" | "icon";
  className?: string;
};

export default function FavoriteButton({
  productId,
  initialIsFavorite,
  addLabel,
  removeLabel,
  variant = "default",
  className,
}: FavoriteButtonProps) {
  const t = useTranslations("Favorites");
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof initialIsFavorite === "boolean") {
      return;
    }

    const load = async () => {
      const res = await fetch(`/api/favorites?productId=${productId}`);
      if (res.ok) {
        const data = (await res.json()) as { isFavorite: boolean };
        setIsFavorite(data.isFavorite);
      }
    };
    load();
  }, [initialIsFavorite, productId]);

  const toggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setLoading(true);
    if (isFavorite) {
      const res = await fetch(`/api/favorites?productId=${productId}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 404) {
        setIsFavorite(false);
      }
    } else {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        setIsFavorite(true);
      }
    }
    setLoading(false);
  };

  const buttonLabel = isFavorite ? removeLabel ?? t("remove") : addLabel ?? t("add");
  const isIcon = variant === "icon";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={buttonLabel}
      aria-pressed={isFavorite}
      title={buttonLabel}
      className={`inline-flex items-center justify-center transition disabled:opacity-60 ${
        isIcon
          ? `h-9 w-9 rounded-full border ${
              isFavorite
                ? "border-rose-300/70 bg-rose-500/15 text-rose-300"
                : "border-white/20 bg-zinc-950/75 text-zinc-200 hover:border-white/40"
            }`
          : "gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:border-white/40"
      } ${className ?? ""}`}
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
      {!isIcon ? <span>{buttonLabel}</span> : null}
    </button>
  );
}
