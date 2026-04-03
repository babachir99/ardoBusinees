"use client";

import { useState } from "react";
import type { HomePromoEntry } from "@/lib/homePromos";

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

type AdminHomePromosPanelProps = {
  locale: string;
  initialPromos: HomePromoEntry[];
  accentOptions: string[];
  lastUpdatedAt?: string | null;
  lastUpdatedBy?: { name?: string | null; email?: string | null } | null;
};

export default function AdminHomePromosPanel({
  locale,
  initialPromos,
  accentOptions,
  lastUpdatedAt,
  lastUpdatedBy,
}: AdminHomePromosPanelProps) {
  const isFr = locale === "fr";
  const [promos, setPromos] = useState(initialPromos);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const updatePromo = <K extends keyof HomePromoEntry>(
    index: number,
    key: K,
    value: HomePromoEntry[K]
  ) => {
    setPromos((current) =>
      current.map((promo, promoIndex) =>
        promoIndex === index ? { ...promo, [key]: value } : promo
      )
    );
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/home-promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promos }),
      });

      if (!response.ok) {
        throw new Error(isFr ? "Impossible d'enregistrer les promos." : "Unable to save promos.");
      }

      setFeedback(isFr ? "Promos homepage mises a jour." : "Homepage promos updated.");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : isFr
            ? "Erreur pendant l'enregistrement."
            : "Saving failed."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/55 p-6 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {isFr ? "Promos homepage" : "Homepage promos"}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {isFr
              ? "Tu pilotes ici les popups promo de la page d'accueil, sans toucher au header."
              : "Manage homepage promo popups here without touching the header."}
          </p>
          {lastUpdatedAt ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              {isFr ? "Derniere mise a jour" : "Last updated"}:{" "}
              {new Date(lastUpdatedAt).toLocaleString(locale)}{" "}
              {lastUpdatedBy
                ? `· ${lastUpdatedBy.name || lastUpdatedBy.email || (isFr ? "admin" : "admin")}`
                : ""}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60"
        >
          {saving ? (isFr ? "Enregistrement..." : "Saving...") : isFr ? "Enregistrer" : "Save"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-xs text-emerald-200">{feedback}</p> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {promos.map((promo, index) => (
          <article
            key={promo.id}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {isFr ? `Promo ${index + 1}` : `Promo ${index + 1}`}
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={promo.enabled}
                  onChange={(event) => updatePromo(index, "enabled", event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-400 focus:ring-emerald-400/40"
                />
                {isFr ? "Active" : "Enabled"}
              </label>
            </div>

            <div className="grid gap-3">
              <input
                value={promo.tag}
                onChange={(event) => updatePromo(index, "tag", event.target.value)}
                placeholder={isFr ? "Tag" : "Tag"}
                className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
              />
              <input
                value={promo.title}
                onChange={(event) => updatePromo(index, "title", event.target.value)}
                placeholder={isFr ? "Titre" : "Title"}
                className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
              />
              <textarea
                value={promo.description}
                onChange={(event) => updatePromo(index, "description", event.target.value)}
                placeholder={isFr ? "Description" : "Description"}
                className="min-h-24 rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-3 text-sm text-white outline-none focus:border-emerald-300/35"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={promo.href}
                  onChange={(event) => updatePromo(index, "href", event.target.value)}
                  placeholder="/stores/jontaado-cares"
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
                <input
                  value={promo.cta}
                  onChange={(event) => updatePromo(index, "cta", event.target.value)}
                  placeholder={isFr ? "CTA" : "CTA"}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {isFr ? "Debut" : "Start"}
                  </span>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(promo.startAt)}
                    onChange={(event) => updatePromo(index, "startAt", fromDateTimeLocalValue(event.target.value))}
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {isFr ? "Fin" : "End"}
                  </span>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(promo.endAt)}
                    onChange={(event) => updatePromo(index, "endAt", fromDateTimeLocalValue(event.target.value))}
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                  />
                </label>
              </div>
              <select
                value={promo.accentClassName}
                onChange={(event) => updatePromo(index, "accentClassName", event.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
              >
                {accentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
