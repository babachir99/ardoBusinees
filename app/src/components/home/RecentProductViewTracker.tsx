"use client";

import { useSessionUserId } from "@/components/auth/SessionScopeProvider";
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
  const sessionUserId = useSessionUserId();
  const effectiveStorageScope = storageScope ?? sessionUserId ?? null;

  useEffect(() => {
    try {
      storeRecentView(effectiveStorageScope, product);
    } catch {
      // ignore storage issues
    }
  }, [effectiveStorageScope, product]);

  return null;
}
