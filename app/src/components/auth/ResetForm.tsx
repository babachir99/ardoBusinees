"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function ResetForm({
  initialEmail = "",
  initialToken = "",
}: {
  initialEmail?: string;
  initialToken?: string;
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.generic"));
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8"
    >
      <h1 className="text-2xl font-semibold">{t("reset.title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("reset.subtitle")}</p>

      <div className="mt-6 grid gap-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("reset.token")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
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
      {success && (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
          <p>{t("reset.success")}</p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-3 rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
          >
            {t("reset.cta")}
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {loading ? t("reset.loading") : t("reset.submit")}
      </button>
    </form>
  );
}
