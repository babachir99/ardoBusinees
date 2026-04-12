"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import CountryPhoneField from "@/components/forms/CountryPhoneField";
import { buildFormDefaults, normalizePhoneInput } from "@/lib/forms/prefill";
import { getDialCode } from "@/lib/locale/country";

type GeoPayload = {
  geoCountry?: string | null;
};

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  phone?: string | null;
  role: string;
  createdAt: string;
};

type ProfileSnapshot = {
  name: string;
  image: string;
  country: string;
  dialCode: string;
  phoneNational: string;
};

function toSnapshot(input: {
  name: string;
  image: string;
  country: string;
  dialCode: string;
  phoneNational: string;
}): ProfileSnapshot {
  return {
    name: input.name.trim(),
    image: input.image.trim(),
    country: input.country.trim().toUpperCase(),
    dialCode: input.dialCode.trim(),
    phoneNational: input.phoneNational.trim(),
  };
}

function isSameSnapshot(a: ProfileSnapshot | null, b: ProfileSnapshot | null): boolean {
  if (!a || !b) return false;
  return (
    a.name === b.name &&
    a.image === b.image &&
    a.country === b.country &&
    a.dialCode === b.dialCode &&
    a.phoneNational === b.phoneNational
  );
}

export default function ProfileEditForm() {
  const t = useTranslations("ProfileEdit");
  const locale = useLocale();
  const router = useRouter();
  const isFr = locale === "fr";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", image: "" });
  const initialPhoneDefaults = buildFormDefaults({
    sessionUser: null,
    geoCountry: null,
  });
  const [contactPhone, setContactPhone] = useState({
    country: initialPhoneDefaults.country,
    dialCode: initialPhoneDefaults.dialCode || getDialCode(initialPhoneDefaults.country),
    phoneNational: initialPhoneDefaults.phoneNational,
  });
  const [initialSnapshot, setInitialSnapshot] = useState<ProfileSnapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const normalizedPhone = useMemo(() => normalizePhoneInput(contactPhone), [contactPhone]);
  const phoneHasContent = contactPhone.phoneNational.trim().length > 0;
  const phoneInvalid = phoneHasContent && !normalizedPhone.validBasic;

  const currentSnapshot = useMemo(
    () =>
      toSnapshot({
        name: form.name,
        image: form.image,
        country: contactPhone.country,
        dialCode: contactPhone.dialCode,
        phoneNational: contactPhone.phoneNational,
      }),
    [form.name, form.image, contactPhone.country, contactPhone.dialCode, contactPhone.phoneNational]
  );

  const hasUnsavedChanges = useMemo(
    () => !isSameSnapshot(initialSnapshot, currentSnapshot),
    [initialSnapshot, currentSnapshot]
  );

  const canSave = !loading && !saving && !uploading && hasUnsavedChanges && !phoneInvalid;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, geoRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/meta/geo", { cache: "no-store" }).catch(() => null),
      ]);

      if (!profileRes.ok) {
        throw new Error(t("errors.load"));
      }

      const data = (await profileRes.json()) as Profile;
      const geoData = geoRes?.ok
        ? ((await geoRes.json().catch(() => null)) as GeoPayload | null)
        : null;
      const defaults = buildFormDefaults({
        sessionUser: { phone: data.phone ?? null },
        geoCountry: geoData?.geoCountry ?? null,
      });

      const nextImage = (data as Profile & { image?: string | null }).image ?? "";
      const nextName = data.name ?? "";
      const nextCountry = defaults.country;
      const nextDialCode = defaults.dialCode || getDialCode(defaults.country);
      const nextPhoneNational = defaults.phoneNational;

      setProfile(data);
      setContactPhone({
        country: nextCountry,
        dialCode: nextDialCode,
        phoneNational: nextPhoneNational,
      });
      setForm({
        name: nextName,
        phone: defaults.fullPhoneE164 || data.phone || "",
        image: nextImage,
      });
      setImagePreview(nextImage || null);
      setInitialSnapshot(
        toSnapshot({
          name: nextName,
          image: nextImage,
          country: nextCountry,
          dialCode: nextDialCode,
          phoneNational: nextPhoneNational,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePhoneFieldChange = (next: {
    country: string;
    dialCode: string;
    phoneNational: string;
  }) => {
    setContactPhone(next);
    const normalized = normalizePhoneInput(next);
    setForm((prev) => ({
      ...prev,
      phone: normalized.validBasic ? normalized.e164 : next.phoneNational.trim(),
    }));
  };

  const changePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError(t("password.errors.required"));
      return;
    }

    if (passwordForm.newPassword.length < 10) {
      setPasswordError(t("password.errors.minLength"));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("password.errors.mismatch"));
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code = String(data?.error ?? "");
        if (code === "INVALID_CURRENT_PASSWORD") {
          setPasswordError(t("password.errors.invalidCurrent"));
        } else if (code === "PASSWORD_TOO_SHORT") {
          setPasswordError(t("password.errors.minLength"));
        } else if (code === "PASSWORD_CHANGE_NOT_AVAILABLE") {
          setPasswordError(t("password.errors.unavailable"));
        } else {
          setPasswordError(t("password.errors.change"));
        }
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setPasswordError(t("password.errors.change"));
    } finally {
      setChangingPassword(false);
    }
  };

  const save = async () => {
    if (phoneInvalid) {
      setError(isFr ? "Numero invalide." : "Invalid phone number.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const finalPhone = normalizedPhone.validBasic
        ? normalizedPhone.e164
        : form.phone.trim();

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: finalPhone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }

      setSuccess(true);
      setInitialSnapshot(currentSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = async () => {
    setError(null);
    setSuccess(false);
    await load();
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <p className="text-sm text-zinc-400">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <p className="text-sm text-zinc-400">{t("errors.load")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 md:pb-0">
      <div className="relative rounded-3xl border border-white/10 bg-zinc-900/80 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-3xl bg-gradient-to-r from-emerald-400/10 via-cyan-400/5 to-indigo-400/10" />

        <div className="relative p-6 md:p-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-5">
            <div>
              <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
              <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
            </div>
            <div className="rounded-full border px-3 py-1 text-xs font-medium text-zinc-200 border-white/15 bg-zinc-950/60">
              {hasUnsavedChanges
                ? isFr
                  ? "Modifications non enregistrees"
                  : "Unsaved changes"
                : isFr
                ? "A jour"
                : "Up to date"}
            </div>
          </header>

          <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
                {isFr ? "Compte" : "Account"}
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs text-zinc-400">{t("fields.email")}</span>
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200">
                  {profile.email}
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-xs text-zinc-400">{t("fields.role")}</span>
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200">
                  {profile.role}
                </div>
              </label>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
                {isFr ? "Profil" : "Profile"}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-white/10 bg-zinc-950">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
                      {(profile.name ?? profile.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-center">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40">
                    {uploading ? t("uploading") : isFr ? "Changer" : "Change"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                          setError(t("errors.fileType"));
                          return;
                        }
                        if (file.size > 2 * 1024 * 1024) {
                          setError(t("errors.fileSize"));
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
                            throw new Error(err?.error || t("errors.save"));
                          }
                          const json = (await res.json()) as { url: string };
                          setForm((prev) => ({ ...prev, image: json.url }));
                          setImagePreview(URL.createObjectURL(file));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : t("errors.save"));
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[11px] text-zinc-500">{isFr ? "PNG/JPG, max 2 MB" : "PNG/JPG, max 2 MB"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs text-zinc-400">{t("fields.name")}</span>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/25"
                    placeholder={t("fields.name")}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-xs text-zinc-400">{t("fields.phone")}</span>
                  <CountryPhoneField
                    value={contactPhone}
                    locale={locale}
                    onChange={handlePhoneFieldChange}
                    className="rounded-xl border border-white/10 bg-zinc-950/40 p-3"
                  />
                  {phoneInvalid ? (
                    <p className="text-xs text-rose-300">
                      {isFr ? "Format de telephone invalide." : "Invalid phone number format."}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      {isFr
                        ? "Le format est normalise automatiquement en international."
                        : "Phone format is normalized automatically to international format."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
                {isFr ? "Securite" : "Security"}
              </h2>
            </div>

            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => {
                  setPasswordError(null);
                  setPasswordSuccess(false);
                  setShowPasswordForm(true);
                }}
                className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold text-white transition hover:border-white/40"
              >
                {t("password.open")}
              </button>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{t("password.title")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordError(null);
                      setPasswordSuccess(false);
                      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                    }}
                    className="text-xs text-zinc-300 underline underline-offset-4"
                  >
                    {t("password.close")}
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{t("password.subtitle")}</p>

                <div className="mt-4 grid gap-3">
                  <input
                    type="password"
                    className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/25"
                    placeholder={t("password.fields.current")}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                  />
                  <input
                    type="password"
                    className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/25"
                    placeholder={t("password.fields.new")}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                  />
                  <input
                    type="password"
                    className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/25"
                    placeholder={t("password.fields.confirm")}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                  />
                </div>

                {passwordError ? <p className="mt-3 text-sm text-rose-300">{passwordError}</p> : null}
                {passwordSuccess ? <p className="mt-3 text-sm text-emerald-300">{t("password.success")}</p> : null}

                <button
                  type="button"
                  onClick={changePassword}
                  disabled={changingPassword}
                  className="mt-4 rounded-full border border-white/20 px-5 py-2 text-xs font-semibold text-white transition hover:border-white/40 disabled:opacity-60"
                >
                  {changingPassword ? t("password.saving") : t("password.save")}
                </button>
              </>
            )}
          </section>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-300">{t("success")}</p> : null}

          <div className="mt-8 hidden items-center justify-between gap-3 border-t border-white/10 pt-4 md:flex md:sticky md:bottom-3 md:bg-zinc-900/90 md:pb-1">
            <button
              type="button"
              onClick={() => void handleResetChanges()}
              disabled={saving || loading}
              className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold text-white transition hover:border-white/40 disabled:opacity-60"
            >
              {isFr ? "Annuler" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 px-6 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving || loading}
            className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40 disabled:opacity-60"
          >
            {isFr ? "Retour" : "Back"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="flex-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
