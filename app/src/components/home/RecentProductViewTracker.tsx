"use client";

import { useEffect } from "react";

const RECENT_VIEWS_STORAGE_KEY = "jontaado_recent_views";
const MAX_RECENT_VIEWS = 6;

type RecentProductViewTrackerProps = {
  product: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    discountPercent?: number | null;
    sellerName?: string | null;
    imageUrl?: string | null;
  };
};

export default function RecentProductViewTracker({
  product,
}: RecentProductViewTrackerProps) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_VIEWS_STORAGE_KEY);
      const current = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];

      const next = [
        {
          ...product,
          viewedAt: Date.now(),
        },
        ...current.filter((item) => item.id !== product.id),
      ].slice(0, MAX_RECENT_VIEWS);

      window.localStorage.setItem(RECENT_VIEWS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("jontaado:recent-views-updated", { detail: next }));
    } catch {
      // ignore storage issues
    }
  }, [product]);

  return null;
}
