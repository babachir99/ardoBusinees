"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import CountryPhoneField from "@/components/forms/CountryPhoneField";
import { buildFormDefaults, normalizePhoneInput } from "@/lib/forms/prefill";
import { getDialCode } from "@/lib/locale/country";

type GeoPayload = {
  geoCountry?: string | null;
};

export default function SignupForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const isFr = locale === "fr";
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const initialPhoneDefaults = buildFormDefaults({
    sessionUser: null,
    geoCountry: null,
  });
  const [contactPhone, setContactPhone] = useState({
    country: initialPhoneDefaults.country,
    dialCode: initialPhoneDefaults.dialCode || getDialCode(initialPhoneDefaults.country),
    phoneNational: initialPhoneDefaults.phoneNational,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadGeoDefaults = async () => {
      const response = await fetch("/api/meta/geo", { cache: "no-store" }).catch(() => null);
      const geo = response?.ok
        ? ((await response.json().catch(() => null)) as GeoPayload | null)
        : null;

      const defaults = buildFormDefaults({
        sessionUser: null,
        geoCountry: geo?.geoCountry ?? null,
      });

      if (cancelled) return;

      setContactPhone({
        country: defaults.country,
        dialCode: defaults.dialCode || getDialCode(defaults.country),
        phoneNational: defaults.phoneNational,
      });
      setPhone((prev) => prev || defaults.fullPhoneE164 || "");
    };

    void loadGeoDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePhoneFieldChange = (next: {
    country: string;
    dialCode: string;
    phoneNational: string;
  }) => {
    setContactPhone(next);
    const normalized = normalizePhoneInput(next);
    setPhone(normalized.validBasic ? normalized.e164 : next.phoneNational.trim());
  };

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !loading &&
    !uploading;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);
    try {
      const normalizedPhone = normalizePhoneInput(contactPhone);
      const finalPhone = normalizedPhone.validBasic
        ? normalizedPhone.e164
        : phone.trim();

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: finalPhone || undefined,
          email,
          password,
          image: imageUrl || undefined,
        }),
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
    <form onSubmit={onSubmit} className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold text-white">{t("signup.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("signup.subtitle")}</p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
          {isFr ? "Profil" : "Profile"}
        </h2>

        <div className="mt-3 grid gap-4 md:grid-cols-[82px_minmax(0,1fr)] md:items-center">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
            {imagePreview ? (
              <img src={imagePreview} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">?</div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800/40">
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
              <p className="mt-1 text-[11px] text-zinc-500">{isFr ? "JPG/PNG, max 2MB" : "JPG/PNG, max 2MB"}</p>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-medium text-zinc-300">{t("fields.name")}</span>
              <input
                className="h-12 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 text-sm text-white outline-none placeholder:text-zinc-600 transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                placeholder={t("fields.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
          {isFr ? "Contact" : "Contact"}
        </h2>
        <div className="mt-3">
          <CountryPhoneField value={contactPhone} locale={locale} onChange={handlePhoneFieldChange} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
          {isFr ? "Acces" : "Access"}
        </h2>
        <div className="mt-3 grid gap-4">
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
                autoComplete="new-password"
                minLength={10}
              />
            <p className={`text-[11px] ${capsLockOn ? "text-amber-300" : "text-zinc-500"}`}>
              {capsLockOn
                ? isFr
                  ? "Caps Lock active"
                  : "Caps Lock enabled"
                : isFr
                ? "Utilise au moins 10 caracteres."
                : "Use at least 10 characters."}
            </p>
          </label>
        </div>
      </section>

      {verifyToken ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
          <p>{t("signup.verifyNote")}</p>
          <button
            type="button"
            onClick={() =>
              router.push(`/verify?email=${encodeURIComponent(email)}&token=${verifyToken}`)
            }
            className="mt-3 rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
          >
            {t("signup.verifyCta")}
          </button>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 px-6 text-sm font-semibold text-zinc-950 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? t("signup.loading") : t("signup.submit")}
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
        {t("signup.google")}
      </button>
    </form>
  );
}
