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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-zinc-900/70 p-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
            mode === "login"
              ? "bg-emerald-400 text-zinc-950"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          {t("login.submit")}
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
            mode === "signup"
              ? "bg-emerald-400 text-zinc-950"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          {t("signup.submit")}
        </button>
      </div>
      {mode === "login" ? <LoginForm /> : <SignupForm />}
    </div>
  );
}
