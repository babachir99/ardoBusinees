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

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    router.push("/profile");
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8"
    >
      <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("login.subtitle")}</p>

      <div className="mt-6 grid gap-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {loading ? t("login.loading") : t("login.submit")}
      </button>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/profile" })}
          className="w-full rounded-full border border-white/15 px-6 py-3 text-xs font-semibold text-white transition hover:border-white/30"
        >
          {t("login.google")}
        </button>
      </div>
      <div className="mt-4 text-center text-xs text-zinc-400">
        <Link href="/forgot" className="underline">
          {t("login.forgot")}
        </Link>
      </div>
    </form>
  );
}
