"use client";

import { useEffect, useState } from "react";

type AdaptivePollingOptions = {
  active?: boolean;
  visibleIntervalMs?: number;
  hiddenIntervalMs?: number;
};

function isDocumentVisible() {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

export default function useAdaptivePolling({
  active = true,
  visibleIntervalMs = 12_000,
  hiddenIntervalMs = 45_000,
}: AdaptivePollingOptions) {
  const [isVisible, setIsVisible] = useState(() => isDocumentVisible());

  useEffect(() => {
    const updateInterval = () => {
      setIsVisible(isDocumentVisible());
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", updateInterval);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", updateInterval);
      window.addEventListener("blur", updateInterval);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", updateInterval);
      }

      if (typeof window !== "undefined") {
        window.removeEventListener("focus", updateInterval);
        window.removeEventListener("blur", updateInterval);
      }
    };
  }, []);

  if (!active) return null;
  return isVisible ? visibleIntervalMs : hiddenIntervalMs;
}
