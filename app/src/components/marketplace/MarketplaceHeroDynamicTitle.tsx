"use client";

import { useEffect, useMemo, useState } from "react";

const exitDurationMs = 420;
const idleDurationMs = 2800;

type MarketplaceHeroDynamicTitleProps = {
  fixedLine: string;
  lines: string[];
  lineClassName?: string;
  layout?: "stacked" | "inline";
};

export default function MarketplaceHeroDynamicTitle({
  fixedLine,
  lines,
  lineClassName = "text-zinc-500",
  layout = "stacked",
}: MarketplaceHeroDynamicTitleProps) {
  const copy = useMemo(() => lines.filter((line) => line.trim().length > 0), [lines]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [activeSlot, setActiveSlot] = useState<"a" | "b">("a");

  useEffect(() => {
    if (copy.length <= 1) return;

    const cycleTimer = window.setTimeout(() => {
      setIncomingIndex((currentIndex + 1) % copy.length);
    }, idleDurationMs);

    return () => window.clearTimeout(cycleTimer);
  }, [copy, currentIndex]);

  const currentLine = copy[currentIndex] ?? copy[0] ?? "";
  const nextLine = incomingIndex === null ? null : copy[incomingIndex] ?? null;
  const isAnimating = nextLine !== null;
  const currentOnSlotA = activeSlot === "a";
  const slotAText = currentOnSlotA ? currentLine : nextLine ?? currentLine;
  const slotBText = currentOnSlotA ? nextLine ?? currentLine : currentLine;

  useEffect(() => {
    if (incomingIndex === null) return;

    const swapTimer = window.setTimeout(() => {
      setCurrentIndex(incomingIndex);
      setActiveSlot((current) => (current === "a" ? "b" : "a"));
      setIncomingIndex(null);
    }, exitDurationMs);

    return () => window.clearTimeout(swapTimer);
  }, [incomingIndex]);

  const inlineLayout = layout === "inline";

  return (
    <span className={inlineLayout ? "inline-flex flex-wrap items-center gap-x-2 gap-y-1" : "block"}>
      <span className={inlineLayout ? "shrink-0 leading-none" : "block"}>{fixedLine}</span>
      <span
        className={`relative ${
          inlineLayout ? "inline-flex h-[1.08em] min-w-[13ch] items-center leading-none" : "mt-1.5 block h-[1.35em]"
        } overflow-hidden leading-tight ${lineClassName}`}
      >
        <span
          className={`absolute inset-0 flex items-center leading-none will-change-transform transition-all duration-[420ms] ease-out motion-reduce:transition-none ${
            currentOnSlotA
              ? isAnimating
                ? "-translate-y-2 opacity-0"
                : "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0"
          }`}
        >
          {slotAText}
        </span>
        <span
          className={`absolute inset-0 flex items-center leading-none will-change-transform transition-all duration-[420ms] ease-out motion-reduce:transition-none ${
            currentOnSlotA
              ? isAnimating
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0"
              : isAnimating
                ? "-translate-y-2 opacity-0"
                : "translate-y-0 opacity-100"
          }`}
          aria-hidden={currentOnSlotA ? !isAnimating : false}
        >
          {slotBText}
        </span>
      </span>
    </span>
  );
}
