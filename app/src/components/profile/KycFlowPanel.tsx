"use client";

import { useEffect } from "react";

type KycFlowPanelProps = {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function KycFlowPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: KycFlowPanelProps) {
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="absolute inset-0 flex items-end justify-end lg:items-stretch">
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative w-full max-h-[88vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-900/95 p-5 text-zinc-100 shadow-[0_-24px_60px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out sm:max-h-[92vh] sm:p-6 lg:h-full lg:max-h-none lg:w-[min(760px,100%)] lg:rounded-none lg:rounded-l-3xl lg:border-l lg:border-t-0 ${
            open ? "translate-y-0 lg:translate-x-0 opacity-100" : "translate-y-full lg:translate-x-full opacity-0"
          }`}
        >
          <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-white/10 bg-zinc-900/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">KYC</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-zinc-950/80 text-zinc-200 transition hover:border-white/35"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4">{children}</div>
        </section>
      </div>
    </div>
  );
}
