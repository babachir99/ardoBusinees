"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

export default function ProfileEditForm() {
  const t = useTranslations("ProfileEdit");
  const locale = useLocale();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const load = async () => {
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

      setProfile(data);
      setContactPhone({
        country: defaults.country,
        dialCode: defaults.dialCode || getDialCode(defaults.country),
        phoneNational: defaults.phoneNational,
      });
      setForm({
        name: data.name ?? "",
        phone: defaults.fullPhoneE164 || data.phone || "",
        image: (data as Profile & { image?: string | null }).image ?? "",
      });
      const initialImage = (data as Profile & { image?: string | null }).image ?? "";
      if (initialImage) {
        setImagePreview(initialImage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const normalizedPhone = normalizePhoneInput(contactPhone);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("errors.load")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>

      <div className="mt-6 grid gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
          {t("fields.email")}: {profile.email}
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
          {t("fields.role")}: {profile.role}
        </div>
      </div>

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
              {uploading ? t("uploading") : t("upload")}
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
          </div>
        </div>
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.name")}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <CountryPhoneField
          value={contactPhone}
          locale={locale}
          onChange={handlePhoneFieldChange}
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-300">{t("success")}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}
