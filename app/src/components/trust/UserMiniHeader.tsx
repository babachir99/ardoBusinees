"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import UserSafetyActions from "@/components/trust/UserSafetyActions";

type UserMiniHeaderProps = {
  locale: string;
  name: string;
  avatarUrl?: string | null;
  roleLabel: string;
  rating?: number | null;
  reviewCount?: number | null;
  userId?: string | null;
  viewerUserId?: string | null;
};

export default function UserMiniHeader({
  locale,
  name,
  avatarUrl,
  roleLabel,
  rating,
  reviewCount,
  userId,
  viewerUserId,
}: UserMiniHeaderProps) {
  const isFr = locale === "fr";
  const canShowSafetyActions = Boolean(userId && viewerUserId && userId !== viewerUserId);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!actionsRef.current) return;
      if (!actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [actionsOpen]);

  const ratingLabel =
    typeof rating === "number" && Number.isFinite(rating)
      ? rating.toFixed(1)
      : isFr
        ? "Nouveau"
        : "New";

  return (
    <div className="flex items-start gap-3">
      <div className="h-11 w-11 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm font-semibold text-zinc-200">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                {roleLabel}
              </span>
              <span className="text-[11px] text-zinc-400">
                {isFr ? "Note" : "Rating"} {ratingLabel}
                {typeof reviewCount === "number" ? ` (${reviewCount})` : ""}
              </span>
            </div>
          </div>

          {canShowSafetyActions && userId ? (
            <div className="relative" ref={actionsRef}>
              <button
                type="button"
                aria-label={isFr ? "Plus d'actions" : "More actions"}
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                onClick={() => setActionsOpen((value) => !value)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/35 bg-sky-300/10 text-sky-100 shadow-[0_0_0_1px_rgba(125,211,252,0.2)] transition hover:border-sky-200/70 hover:bg-sky-300/20"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>

              {actionsOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-white/15 bg-zinc-900/95 p-2 shadow-2xl"
                >
                  <UserSafetyActions
                    userId={userId}
                    locale={locale}
                    variant="menu"
                    onActionComplete={() => setActionsOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
