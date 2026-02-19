"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  locale: string;
  isLoggedIn: boolean;
  currentUserRole: string | null;
  onRequireLogin: () => void;
};

function toErrorMessage(data: unknown, fallback: string) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof record?.message === "string") return record.message;
  if (typeof record?.error === "string") return record.error;
  return fallback;
}

export default function TiakCourierAvailabilityPanel({
  locale,
  isLoggedIn,
  currentUserRole,
  onRequireLogin,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [zonesInput, setZonesInput] = useState("");

  const isCourier = currentUserRole === "COURIER";

  const zoneCount = useMemo(() => {
    const parsed = zonesInput
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return new Set(parsed).size;
  }, [zonesInput]);

  useEffect(() => {
    if (!isCourier || !isLoggedIn) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const response = await fetch("/api/tiak/courier/me", {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok) {
          setErrorMsg(
            toErrorMessage(
              data,
              locale === "fr" ? "Chargement indisponible." : "Unable to load availability."
            )
          );
          return;
        }

        const profile = data && typeof data === "object" ? (data as { profile?: unknown }).profile : null;
        if (profile && typeof profile === "object") {
          const record = profile as { isOnline?: unknown; zones?: unknown };
          setIsOnline(Boolean(record.isOnline));
          if (Array.isArray(record.zones)) {
            const zones = record.zones.filter((entry): entry is string => typeof entry === "string");
            setZonesInput(zones.join(", "));
          }
        }
      } catch {
        if (!cancelled) {
          setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isCourier, isLoggedIn, locale]);

  if (!isCourier) return null;

  async function saveAvailability() {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const zones = zonesInput
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/tiak/courier/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isOnline,
          zones,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMsg(
          toErrorMessage(
            data,
            locale === "fr" ? "Sauvegarde impossible." : "Unable to save availability."
          )
        );
        return;
      }

      setSuccessMsg(locale === "fr" ? "Sauvegarde" : "Saved");
    } catch {
      setErrorMsg(locale === "fr" ? "Erreur serveur." : "Server error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-lg font-semibold text-white">
        {locale === "fr" ? "Disponibilite" : "Availability"}
      </h2>

      <div className="mt-3 grid gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isOnline}
            onChange={(event) => setIsOnline(event.target.checked)}
            disabled={loading || saving}
          />
          {isOnline
            ? locale === "fr"
              ? "Online"
              : "Online"
            : locale === "fr"
              ? "Offline"
              : "Offline"}
        </label>

        <label className="grid gap-1 text-xs text-zinc-300">
          {locale === "fr" ? "Zones (virgules)" : "Zones (comma separated)"}
          <textarea
            className="min-h-[88px] rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={zonesInput}
            onChange={(event) => setZonesInput(event.target.value)}
            placeholder={locale === "fr" ? "Plateau, Medina, Almadies" : "Downtown, Midtown"}
            maxLength={320}
          />
          <span className="text-[11px] text-zinc-500">
            {locale === "fr" ? "Max 10 zones" : "Max 10 zones"} · {zoneCount}/10
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void saveAvailability()}
            disabled={saving || loading}
            className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-60"
          >
            {saving
              ? locale === "fr"
                ? "Enregistrement..."
                : "Saving..."
              : locale === "fr"
                ? "Enregistrer"
                : "Save"}
          </button>

          {successMsg && <span className="text-xs text-emerald-300">{successMsg}</span>}
        </div>

        {errorMsg && <p className="text-xs text-rose-300">{errorMsg}</p>}
      </div>
    </section>
  );
}

