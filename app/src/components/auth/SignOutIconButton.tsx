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
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
      >
        <path d="M12 3v9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.3 5.8a8 8 0 1 0 9.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
