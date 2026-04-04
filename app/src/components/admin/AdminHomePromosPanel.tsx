"use client";

import { useState } from "react";
import SponsoredPlacement from "@/components/ads/SponsoredPlacement";
import type { HomePromoEntry } from "@/lib/homePromos.shared";
import type { HomePromoTrackingSummary } from "@/lib/homePromos";

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

function getPlacementLabel(locale: string, placement: HomePromoEntry["placement"]) {
  const isFr = locale === "fr";

  switch (placement) {
    case "HOME_POPUP":
      return isFr ? "Popup accueil" : "Homepage popup";
    case "HOME_INLINE":
      return isFr ? "Bandeau accueil" : "Homepage banner";
    case "HOME_PRODUCT_CARD":
      return isFr ? "Carte dans les produits" : "Product-feed card";
    case "STORE_INLINE":
      return isFr ? "Bandeau verticale" : "Vertical banner";
    default:
      return placement;
  }
}

function getAudienceLabel(locale: string, audience: HomePromoEntry["audience"]) {
  const isFr = locale === "fr";

  switch (audience) {
    case "ALL":
      return isFr ? "Tout le monde" : "Everyone";
    case "AUTH":
      return isFr ? "Connectes uniquement" : "Signed-in only";
    case "GUEST":
      return isFr ? "Invites uniquement" : "Guests only";
    default:
      return audience;
  }
}

function getPreviewVariant(placement: HomePromoEntry["placement"]): "popup" | "inline" | "product-card" {
  if (placement === "HOME_POPUP") return "popup";
  if (placement === "HOME_PRODUCT_CARD") return "product-card";
  return "inline";
}

const targetingOptions = [
  { value: "jontaado-cares", fr: "CARES", en: "CARES" },
  { value: "jontaado-presta", fr: "PRESTA", en: "PRESTA" },
  { value: "jontaado-cars", fr: "CARS", en: "CARS" },
  { value: "jontaado-gp", fr: "GP", en: "GP" },
  { value: "jontaado-immo", fr: "IMMO", en: "IMMO" },
  { value: "jontaado-tiak-tiak", fr: "TIAK", en: "TIAK" },
] as const;

type AdminHomePromosPanelProps = {
  locale: string;
  initialPromos: HomePromoEntry[];
  accentOptions: string[];
  placementOptions: HomePromoEntry["placement"][];
  audienceOptions: HomePromoEntry["audience"][];
  trackingSummary: HomePromoTrackingSummary;
  lastUpdatedAt?: string | null;
  lastUpdatedBy?: { name?: string | null; email?: string | null } | null;
};

export default function AdminHomePromosPanel({
  locale,
  initialPromos,
  accentOptions,
  placementOptions,
  audienceOptions,
  trackingSummary,
  lastUpdatedAt,
  lastUpdatedBy,
}: AdminHomePromosPanelProps) {
  const isFr = locale === "fr";
  const [promos, setPromos] = useState(initialPromos);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const addPromo = () => {
    const generatedId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPromos((current) => [
      ...current,
      {
        id: generatedId,
        tag: "Sponsorise",
        title: isFr ? `Campagne ${current.length + 1}` : `Campaign ${current.length + 1}`,
        description: isFr
          ? "Nouvelle campagne sponsorisee JONTAADO."
          : "New JONTAADO sponsored campaign.",
        href: "/shop",
        cta: isFr ? "Voir plus" : "Learn more",
        accentClassName: accentOptions[0] ?? "",
        advertiserName: isFr ? "Annonceur" : "Advertiser",
        advertiserLogoUrl: null,
        imageUrl: null,
        placement: "HOME_PRODUCT_CARD",
        audience: "ALL",
        targetStoreSlugs: [],
        sponsoredLabel: isFr ? "Sponsorise" : "Sponsored",
        openInNewTab: false,
        impressionCap: null,
        rotationSeconds: 8,
        priority: 10,
        enabled: false,
        startAt: null,
        endAt: null,
      },
    ]);
  };

  const removePromo = (index: number) => {
    setPromos((current) => current.filter((_, promoIndex) => promoIndex !== index));
  };

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

      const payload = (await response.json()) as {
        entries?: HomePromoEntry[];
      };
      if (Array.isArray(payload.entries)) {
        setPromos(payload.entries);
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
            {isFr ? "Campagnes sponsorisees homepage" : "Homepage sponsored campaigns"}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {isFr
              ? "Tu pilotes ici les campagnes popup et inline de la page d'accueil, sans toucher au header."
              : "Manage homepage popup and inline campaigns here without touching the header."}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-400">
          {isFr
            ? `${promos.length} campagne(s) configuree(s).`
            : `${promos.length} campaign(s) configured.`}
        </p>
        <button
          type="button"
          onClick={addPromo}
          className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-emerald-300/30 hover:bg-white/10"
        >
          {isFr ? "Ajouter une campagne" : "Add campaign"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-xs text-emerald-200">{feedback}</p> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          {
            label: isFr ? "Impressions 30j" : "Impressions 30d",
            value: trackingSummary.totals.IMPRESSION,
          },
          {
            label: isFr ? "Clics 30j" : "Clicks 30d",
            value: trackingSummary.totals.CLICK,
          },
          {
            label: isFr ? "CTR moyen" : "Average CTR",
            value: `${trackingSummary.ctr}%`,
          },
          {
            label: isFr ? "Trafic invite" : "Guest traffic",
            value: trackingSummary.anonymousTotals.IMPRESSION,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>

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
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={promo.enabled}
                    onChange={(event) => updatePromo(index, "enabled", event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-400 focus:ring-emerald-400/40"
                  />
                  {isFr ? "Active" : "Enabled"}
                </label>
                <button
                  type="button"
                  onClick={() => removePromo(index)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-rose-300/35 hover:bg-rose-400/10 hover:text-rose-200"
                  aria-label={isFr ? "Supprimer la campagne" : "Remove campaign"}
                  title={isFr ? "Supprimer la campagne" : "Remove campaign"}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                    <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {trackingSummary.byPromoId[promo.id] ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-zinc-900/45 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {isFr ? "Impressions" : "Impressions"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {trackingSummary.byPromoId[promo.id].impressions}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/45 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {isFr ? "Clics" : "Clicks"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {trackingSummary.byPromoId[promo.id].clicks}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/45 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">CTR</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {trackingSummary.byPromoId[promo.id].ctr}%
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/45 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {isFr ? "Invites" : "Guests"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {trackingSummary.byPromoId[promo.id].anonymousImpressions}
                  </p>
                </div>
              </div>
            ) : null}

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
                  value={promo.advertiserName}
                  onChange={(event) => updatePromo(index, "advertiserName", event.target.value)}
                  placeholder={isFr ? "Annonceur" : "Advertiser"}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
                <input
                  value={promo.sponsoredLabel}
                  onChange={(event) => updatePromo(index, "sponsoredLabel", event.target.value)}
                  placeholder={isFr ? "Badge sponsorise" : "Sponsored badge"}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={promo.advertiserLogoUrl ?? ""}
                  onChange={(event) => updatePromo(index, "advertiserLogoUrl", event.target.value || null)}
                  placeholder={isFr ? "Logo annonceur (/image ou https://)" : "Advertiser logo (/image or https://)"}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
                <input
                  value={promo.imageUrl ?? ""}
                  onChange={(event) => updatePromo(index, "imageUrl", event.target.value || null)}
                  placeholder={isFr ? "Visuel campagne (/image ou https://)" : "Campaign visual (/image or https://)"}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={promo.href}
                  onChange={(event) => updatePromo(index, "href", event.target.value)}
                  placeholder={isFr ? "/stores/jontaado-cares ou https://..." : "/stores/jontaado-cares or https://..."}
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
                <select
                  value={promo.placement}
                  onChange={(event) => updatePromo(index, "placement", event.target.value as HomePromoEntry["placement"])}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                >
                  {placementOptions.map((option) => (
                    <option key={option} value={option}>
                      {getPlacementLabel(locale, option)}
                    </option>
                  ))}
                </select>
                <select
                  value={promo.audience}
                  onChange={(event) => updatePromo(index, "audience", event.target.value as HomePromoEntry["audience"])}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                >
                  {audienceOptions.map((option) => (
                    <option key={option} value={option}>
                      {getAudienceLabel(locale, option)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {isFr ? "Priorite dans ce format" : "Priority in this format"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={promo.priority}
                    onChange={(event) =>
                      updatePromo(index, "priority", Math.max(0, Math.min(999, Number(event.target.value) || 0)))
                    }
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                  />
                </label>
                <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/50 px-3 py-2.5 text-xs text-zinc-400">
                  {isFr
                    ? "Plus la priorite est haute, plus la campagne remonte parmi les autres du meme format."
                    : "Higher priority moves the campaign first among others sharing the same format."}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={promo.targetStoreSlugs.join(", ")}
                  onChange={(event) =>
                    updatePromo(
                      index,
                      "targetStoreSlugs",
                      event.target.value
                        .split(",")
                        .map((item) => item.trim().toLowerCase())
                        .filter(Boolean)
                    )
                  }
                  placeholder={isFr ? "Verticales cibles: jontaado-presta, jontaado-cars" : "Target stores: jontaado-presta, jontaado-cars"}
                  className="h-10 rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                />
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={promo.openInNewTab}
                    onChange={(event) => updatePromo(index, "openInNewTab", event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-400 focus:ring-emerald-400/40"
                  />
                  {isFr ? "Nouvel onglet" : "New tab"}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetingOptions.map((option) => {
                  const active = promo.targetStoreSlugs.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        updatePromo(
                          index,
                          "targetStoreSlugs",
                          active
                            ? promo.targetStoreSlugs.filter((slug) => slug !== option.value)
                            : [...promo.targetStoreSlugs, option.value]
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                        active
                          ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      {isFr ? option.fr : option.en}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {isFr ? "Cap impressions" : "Impression cap"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={promo.impressionCap ?? ""}
                    onChange={(event) =>
                      updatePromo(
                        index,
                        "impressionCap",
                        event.target.value ? Math.max(1, Math.min(999, Number(event.target.value) || 1)) : null
                      )
                    }
                    placeholder={isFr ? "Aucun cap" : "No cap"}
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                  />
                </label>
                <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/50 px-3 py-2.5 text-xs text-zinc-400">
                  {isFr
                    ? "Tu peux deja preparer le cap d'affichage, meme si la V1 reste surtout orientee tracking et placement."
                    : "You can already prepare the display cap, even if V1 mainly focuses on tracking and placement."}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {isFr ? "Rotation (sec)" : "Rotation (sec)"}
                  </span>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={promo.rotationSeconds ?? ""}
                    onChange={(event) =>
                      updatePromo(
                        index,
                        "rotationSeconds",
                        event.target.value ? Math.max(3, Math.min(60, Number(event.target.value) || 8)) : null
                      )
                    }
                    placeholder="8"
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                  />
                </label>
                <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/50 px-3 py-2.5 text-xs text-zinc-400">
                  {isFr
                    ? "Si plusieurs campagnes partagent le meme format, elles tournent dans le bloc selon cette duree."
                    : "If multiple campaigns share the same format, they rotate in the slot using this duration."}
                </div>
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

              <div className="rounded-2xl border border-white/10 bg-zinc-900/35 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      {isFr ? "Apercu live" : "Live preview"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {getPlacementLabel(locale, promo.placement)} · {getAudienceLabel(locale, promo.audience)}
                    </p>
                  </div>
                  {promo.rotationSeconds ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
                      {isFr ? `Rotation ${promo.rotationSeconds}s` : `${promo.rotationSeconds}s rotation`}
                    </span>
                  ) : null}
                </div>

                {promo.placement === "HOME_POPUP" ? (
                  <div className={`overflow-hidden rounded-[1.7rem] border bg-gradient-to-br ${promo.accentClassName} p-4 shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl`}>
                    <SponsoredPlacement
                      locale={locale}
                      promo={promo}
                      variant={getPreviewVariant(promo.placement)}
                      trackEvents={false}
                    />
                  </div>
                ) : (
                  <SponsoredPlacement
                    locale={locale}
                    promo={promo}
                    variant={getPreviewVariant(promo.placement)}
                    trackEvents={false}
                  />
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

