"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GpTripDetailsPopoverProps = {
  locale: string;
  originAddress: string;
  destinationAddress: string;
  arrivalDate?: string | null;
  deliveryStart?: string | null;
  notes?: string | null;
};

type PopoverPlacement = "top" | "bottom";

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
  arrowLeft: number;
  placement: PopoverPlacement;
};

const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 10;
const DESKTOP_WIDTH = 320;

export default function GpTripDetailsPopover({
  locale,
  originAddress,
  destinationAddress,
  arrivalDate,
  deliveryStart,
  notes,
}: GpTripDetailsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({
    top: 0,
    left: 0,
    width: DESKTOP_WIDTH,
    arrowLeft: 40,
    placement: "top",
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const triggerRect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const panelRect = panel.getBoundingClientRect();
      const panelWidth = Math.min(
        Math.max(panelRect.width || DESKTOP_WIDTH, 260),
        viewportWidth - VIEWPORT_MARGIN * 2
      );
      const panelHeight = panelRect.height || 220;

      let left = triggerRect.left + triggerRect.width / 2 - panelWidth / 2;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - panelWidth - VIEWPORT_MARGIN));

      const topIfAbove = triggerRect.top - panelHeight - TRIGGER_GAP;
      const topIfBelow = triggerRect.bottom + TRIGGER_GAP;

      let placement: PopoverPlacement = "top";
      let top = topIfAbove;

      if (topIfAbove < VIEWPORT_MARGIN) {
        placement = "bottom";
        top = topIfBelow;
      }

      if (placement === "bottom" && top + panelHeight > viewportHeight - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, viewportHeight - panelHeight - VIEWPORT_MARGIN);
      }

      const triggerCenterX = triggerRect.left + triggerRect.width / 2;
      const arrowLeft = Math.max(16, Math.min(triggerCenterX - left, panelWidth - 16));

      setPosition({
        top,
        left,
        width: panelWidth,
        arrowLeft,
        placement,
      });
    };

    const raf = window.requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
      >
        {locale === "fr" ? "Voir les details" : "View details"}
      </button>

      {mounted && open
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[120]">
              <div
                ref={panelRef}
                style={{
                  top: `${position.top}px`,
                  left: `${position.left}px`,
                  width: `${position.width}px`,
                }}
                className="pointer-events-auto fixed rounded-2xl border border-white/15 bg-zinc-900/85 p-3 text-xs text-zinc-200 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <span
                  aria-hidden
                  style={{ left: `${position.arrowLeft}px` }}
                  className={`absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-white/20 bg-zinc-900/85 ${
                    position.placement === "top"
                      ? "-bottom-1.5 border-t-0 border-l-0"
                      : "-top-1.5 border-r-0 border-b-0"
                  }`}
                />

                <div className="grid gap-2">
                  <p>
                    <span className="text-zinc-400">{locale === "fr" ? "Depart:" : "Departure:"}</span>{" "}
                    {originAddress}
                  </p>
                  <p>
                    <span className="text-zinc-400">{locale === "fr" ? "Arrivee:" : "Arrival:"}</span>{" "}
                    {destinationAddress}
                  </p>
                  {arrivalDate ? (
                    <p>
                      <span className="text-zinc-400">{locale === "fr" ? "Date d'arrivee:" : "Arrival date:"}</span>{" "}
                      {arrivalDate}
                    </p>
                  ) : null}
                  {deliveryStart ? (
                    <p>
                      <span className="text-zinc-400">{locale === "fr" ? "Debut livraison:" : "Delivery start:"}</span>{" "}
                      {deliveryStart}
                    </p>
                  ) : null}
                  {notes ? (
                    <p>
                      <span className="text-zinc-400">{locale === "fr" ? "Notes:" : "Notes:"}</span>{" "}
                      {notes}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
