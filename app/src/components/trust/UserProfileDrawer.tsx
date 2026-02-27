"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import UserMiniHeader from "@/components/trust/UserMiniHeader";

type UserProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  locale: string;
  name: string;
  avatarUrl?: string | null;
  roleLabel: string;
  rating?: number | null;
  reviewCount?: number | null;
  reliabilityLabel?: string;
  userId?: string | null;
  viewerUserId?: string | null;
  details?: Array<{ label: string; value: string }>;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  children?: ReactNode;
};

export default function UserProfileDrawer({
  open,
  onClose,
  locale,
  name,
  avatarUrl,
  roleLabel,
  rating,
  reviewCount,
  reliabilityLabel,
  userId,
  viewerUserId,
  details = [],
  primaryAction,
  children,
}: UserProfileDrawerProps) {
  const isFr = locale === "fr";

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex justify-end bg-black/70" role="dialog" aria-modal="true">
      <button type="button" className="flex-1 cursor-default" aria-label={isFr ? "Fermer" : "Close"} onClick={onClose} />
      <aside className="w-full max-w-md overflow-y-auto border-l border-white/10 bg-zinc-950 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{isFr ? "Profil" : "Profile"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200"
          >
            {isFr ? "Fermer" : "Close"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <UserMiniHeader
            locale={locale}
            name={name}
            avatarUrl={avatarUrl}
            roleLabel={roleLabel}
            rating={rating}
            reviewCount={reviewCount}
            userId={userId}
            viewerUserId={viewerUserId}
          />

          {reliabilityLabel ? (
            <p className="mt-3 inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] text-emerald-200">
              {reliabilityLabel}
            </p>
          ) : null}

          <div className="mt-3 grid gap-2 text-xs text-zinc-300">
            {details.map((detail) => (
              <p key={detail.label}>
                <span className="text-zinc-500">{detail.label}:</span> {detail.value}
              </p>
            ))}
          </div>

          {children}

          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="mt-4 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
