"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({
  label = "Se deconnecter",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
    >
      {label}
    </button>
  );
}
