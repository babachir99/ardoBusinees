"use client";

import type { ReactNode } from "react";
import UserMiniHeader from "@/components/trust/UserMiniHeader";

type PublicUserCardProps = {
  locale: string;
  name: string;
  avatarUrl?: string | null;
  roleLabel: string;
  rating?: number | null;
  reviewCount?: number | null;
  reliabilityLabel?: string;
  userId?: string | null;
  viewerUserId?: string | null;
  updatedAt?: string | null;
  details?: Array<{ label: string; value: string }>;
  onViewProfile?: () => void;
  viewProfileLabel?: string;
  children?: ReactNode;
};

export default function PublicUserCard({
  locale,
  name,
  avatarUrl,
  roleLabel,
  rating,
  reviewCount,
  reliabilityLabel,
  userId,
  viewerUserId,
  updatedAt,
  details = [],
  onViewProfile,
  viewProfileLabel,
  children,
}: PublicUserCardProps) {
  const isFr = locale === "fr";

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
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

      <div className="mt-3 grid gap-1 text-xs text-zinc-300">
        {details.map((detail) => (
          <p key={detail.label}>
            <span className="text-zinc-500">{detail.label}:</span> {detail.value}
          </p>
        ))}
      </div>

      {updatedAt ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          {isFr ? "Mise a jour" : "Updated"}: {new Date(updatedAt).toLocaleDateString(isFr ? "fr-FR" : "en-US")}
        </p>
      ) : null}

      {children}

      {onViewProfile ? (
        <button
          type="button"
          onClick={onViewProfile}
          className="mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-white/40"
        >
          {viewProfileLabel ?? (isFr ? "Voir profil" : "View profile")}
        </button>
      ) : null}
    </article>
  );
}
