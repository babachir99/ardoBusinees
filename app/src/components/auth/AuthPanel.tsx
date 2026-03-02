"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

type AuthPanelProps = {
  defaultMode?: "login" | "signup";
};

export default function AuthPanel({ defaultMode = "login" }: AuthPanelProps) {
  const t = useTranslations("Auth");
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative rounded-3xl border border-zinc-800/80 bg-zinc-900/65 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur md:p-7">
        <div className="rounded-full border border-zinc-800 bg-zinc-900/70 p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full px-4 py-2.5 text-xs font-semibold transition duration-200 ease-out ${
                mode === "login"
                  ? "bg-emerald-400 text-zinc-950 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                  : "text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {t("login.submit")}
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-4 py-2.5 text-xs font-semibold transition duration-200 ease-out ${
                mode === "signup"
                  ? "bg-emerald-400 text-zinc-950 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                  : "text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {t("signup.submit")}
            </button>
          </div>
        </div>

        <div className="mt-6">{mode === "login" ? <LoginForm /> : <SignupForm />}</div>
      </div>
    </div>
  );
}
