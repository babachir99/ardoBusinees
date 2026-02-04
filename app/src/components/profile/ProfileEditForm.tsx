"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  createdAt: string;
};

export default function ProfileEditForm() {
  const t = useTranslations("ProfileEdit");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Profile;
      setProfile(data);
      setForm({
        name: data.name ?? "",
        phone: data.phone ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.name")}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("fields.phone")}
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
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
