"use client";

import { storeRecentView } from "@/lib/recentSignals";
import { useEffect } from "react";

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
  storageScope?: string | null;
};

export default function RecentProductViewTracker({
  product,
  storageScope,
}: RecentProductViewTrackerProps) {
  useEffect(() => {
    try {
      storeRecentView(storageScope, product);
    } catch {
      // ignore storage issues
    }
  }, [product, storageScope]);

  return null;
}
