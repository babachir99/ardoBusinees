"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

export default function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(t("errors.invalid"));
      return;
    }
    router.push("/");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold text-white">{t("login.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("login.subtitle")}</p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-medium text-zinc-300">{t("fields.email")}</span>
          <input
            className="h-12 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 text-sm text-white outline-none placeholder:text-zinc-600 transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
            placeholder={t("fields.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium text-zinc-300">{t("fields.password")}</span>
          <input
            type="password"
            className="h-12 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 text-sm text-white outline-none placeholder:text-zinc-600 transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
            placeholder={t("fields.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
            autoComplete="current-password"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">
              {capsLockOn
                ? "Caps Lock active"
                : " "}
            </p>
            <Link href="/forgot" className="text-xs text-zinc-400 transition hover:text-emerald-300">
              {t("login.forgot")}
            </Link>
          </div>
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 px-6 text-sm font-semibold text-zinc-950 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? t("login.loading") : t("login.submit")}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{"OU"}</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="h-12 w-full rounded-full border border-zinc-800 px-6 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800/40"
      >
        {t("login.google")}
      </button>
    </form>
  );
}
