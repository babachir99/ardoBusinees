"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function SignupForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password, image: imageUrl || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.generic"));
      }
      const data = (await res.json()) as { token?: string };
      setVerifyToken(data.token ?? null);
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
      <h1 className="text-2xl font-semibold">{t("signup.title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("signup.subtitle")}</p>

      <div className="mt-6 grid gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-900">
            {imagePreview ? (
              <img src={imagePreview} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                ?
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-[11px] text-zinc-400">{t("fields.avatar")}</p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/15 px-4 py-2 text-[11px] text-white transition hover:border-white/40">
              {uploading ? t("signup.uploading") : t("signup.upload")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    setError(t("signup.errors.fileType"));
                    return;
                  }
                  if (file.size > 2 * 1024 * 1024) {
                    setError(t("signup.errors.fileSize"));
                    return;
                  }
                  setUploading(true);
                  setError(null);
                  try {
                    const data = new FormData();
                    data.append("file", file);
                    const res = await fetch("/api/upload", { method: "POST", body: data });
                    if (!res.ok) {
                      const err = await res.json().catch(() => null);
                      throw new Error(err?.error || t("errors.generic"));
                    }
                    const json = (await res.json()) as { url: string };
                    setImageUrl(json.url);
                    setImagePreview(URL.createObjectURL(file));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t("errors.generic"));
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
        </div>
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
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
      {verifyToken && (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
          <p>{t("signup.verifyNote")}</p>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/verify?email=${encodeURIComponent(email)}&token=${verifyToken}`
              )
            }
            className="mt-3 rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
          >
            {t("signup.verifyCta")}
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {loading ? t("signup.loading") : t("signup.submit")}
      </button>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/profile" })}
          className="w-full rounded-full border border-white/15 px-6 py-3 text-xs font-semibold text-white transition hover:border-white/30"
        >
          {t("signup.google")}
        </button>
      </div>
    </form>
  );
}
