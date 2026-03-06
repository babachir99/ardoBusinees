"use client";

import { type ReactNode, useEffect } from "react";

type Props = {
  open: boolean;
  locale: string;
  onClose: () => void;
  children: ReactNode;
};

export default function PrestaNeedPublishPopup({
  open,
  locale,
  onClose,
  children,
}: Props) {
  const isFr = locale === "fr";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        aria-label={isFr ? "Fermer la publication de besoin" : "Close need publish"}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isFr ? "Publier un besoin" : "Publish a need"}
        className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-[520px]"
      >
        <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="border-b border-zinc-800 p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                  {isFr ? "Action importante" : "Important action"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {isFr ? "Publier un besoin" : "Publish a need"}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {isFr
                    ? "Decris ton besoin pour recevoir rapidement des propositions."
                    : "Describe your need to receive proposals quickly."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {isFr ? "Fermer" : "Close"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

