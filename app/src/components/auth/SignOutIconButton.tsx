"use client";

import { signOut } from "next-auth/react";

export default function SignOutIconButton({
  label = "Se deconnecter",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-sm text-white transition hover:border-white/60"
    >
      ⏻
    </button>
  );
}
