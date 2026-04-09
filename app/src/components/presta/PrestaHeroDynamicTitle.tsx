"use client";

import { useEffect, useMemo, useState } from "react";

const exitDurationMs = 360;
const idleDurationMs = 2400;

const lines = {
  fr: [
    "pour gagner du temps",
    "pres de chez toi",
    "en quelques clics",
    "en toute confiance",
  ],
  en: [
    "to save time",
    "near you",
    "in just a few clicks",
    "with confidence",
  ],
} as const;

export default function PrestaHeroDynamicTitle({
  locale,
}: {
  locale: string;
}) {
  const copy = useMemo(() => (locale === "fr" ? lines.fr : lines.en), [locale]);
  const fixedLine = locale === "fr" ? "Trouve ou propose un service" : "Find or offer a service";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (copy.length <= 1) return;

    const cycleTimer = window.setTimeout(() => {
      setIncomingIndex((currentIndex + 1) % copy.length);
    }, idleDurationMs);

    return () => window.clearTimeout(cycleTimer);
  }, [copy, currentIndex]);

  useEffect(() => {
    if (incomingIndex === null) return;

    const swapTimer = window.setTimeout(() => {
      setCurrentIndex(incomingIndex);
      setIncomingIndex(null);
    }, exitDurationMs);

    return () => window.clearTimeout(swapTimer);
  }, [incomingIndex]);

  const currentLine = copy[currentIndex] ?? copy[0] ?? "";
  const nextLine = incomingIndex === null ? null : copy[incomingIndex] ?? null;
  const isAnimating = nextLine !== null;

  return (
    <span className="block">
      <span className="block">{fixedLine}</span>
      <span className="relative mt-1 block h-[1.45em] overflow-hidden text-zinc-400">
        <span
          className={`absolute inset-x-0 top-0 block transition-all duration-300 ease-out motion-reduce:transition-none ${
            isAnimating ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          {currentLine}
        </span>
        <span
          className={`absolute inset-x-0 top-0 block transition-all duration-300 ease-out motion-reduce:transition-none ${
            isAnimating ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
          aria-hidden={!isAnimating}
        >
          {nextLine ?? currentLine}
        </span>
      </span>
    </span>
  );
}
