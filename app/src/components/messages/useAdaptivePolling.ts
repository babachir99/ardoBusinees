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

function getNetworkMultiplier() {
  if (typeof navigator === "undefined") return 1;

  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;

  if (!connection) return 1;
  if (connection.saveData) return 3;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return 3;
  if (connection.effectiveType === "3g") return 2;
  return 1;
}

export default function useAdaptivePolling({
  active = true,
  visibleIntervalMs = 12_000,
  hiddenIntervalMs = 45_000,
}: AdaptivePollingOptions) {
  const [isVisible, setIsVisible] = useState(() => isDocumentVisible());
  const [networkMultiplier, setNetworkMultiplier] = useState(() => getNetworkMultiplier());

  useEffect(() => {
    const updateInterval = () => {
      setIsVisible(isDocumentVisible());
      setNetworkMultiplier(getNetworkMultiplier());
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", updateInterval);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", updateInterval);
      window.addEventListener("blur", updateInterval);
    }

    const connection = (navigator as Navigator & {
      connection?: {
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    }).connection;

    connection?.addEventListener?.("change", updateInterval);

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", updateInterval);
      }

      if (typeof window !== "undefined") {
        window.removeEventListener("focus", updateInterval);
        window.removeEventListener("blur", updateInterval);
      }

      connection?.removeEventListener?.("change", updateInterval);
    };
  }, []);

  if (!active) return null;
  return (isVisible ? visibleIntervalMs : hiddenIntervalMs) * networkMultiplier;
}
