"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import SponsoredPlacement from "@/components/ads/SponsoredPlacement";
import type { HomePromoEntry } from "@/lib/homePromos.shared";
import {
  buildGeneratedPromoId,
  fromDateTimeLocalValue,
  getAudienceLabel,
  getPlacementContextDescription,
  getPlacementLabel,
  getPreviewVariant,
  getPromoStatusMeta,
  targetingOptions,
  toDateTimeLocalValue,
} from "@/components/admin/homePromoAdminShared";

type AdminHomePromosPanelProps = {
  locale: string;
  initialPromos: HomePromoEntry[];
  accentOptions: string[];
  placementOptions: HomePromoEntry["placement"][];
  audienceOptions: HomePromoEntry["audience"][];
  lastUpdatedAt?: string | null;
  lastUpdatedBy?: string | null;
};

type PreviewMode = "popup" | "inline" | "product-card";
type SectionKey = "content" | "targeting" | "settings" | "planning";

type AccordionSectionProps = {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function createDraftPromo(locale: string, accentOptions: string[]): HomePromoEntry {
  const isFr = locale === "fr";

  return {
    id: buildGeneratedPromoId(),
    tag: isFr ? "Sponsorise" : "Sponsored",
    title: isFr ? "Nouvelle campagne" : "New campaign",
    description: isFr
      ? "Mettez en avant une offre, une verticale ou une operation speciale."
      : "Highlight an offer, a vertical, or a special operation.",
    href: "/shop",
    cta: isFr ? "Voir plus" : "See more",
    accentClassName:
      accentOptions[0] ??
      "from-emerald-400/22 via-emerald-500/8 to-zinc-950 border-emerald-300/20",
    advertiserName: "JONTAADO ADS",
    advertiserLogoUrl: "/logo.png",
    imageUrl: "/stores/presta.png",
    placement: "HOME_INLINE",
    audience: "ALL",
    targetStoreSlugs: [],
    sponsoredLabel: isFr ? "Sponsorise" : "Sponsored",
    openInNewTab: false,
    impressionCap: null,
    rotationSeconds: 8,
    priority: 50,
    enabled: false,
    startAt: null,
    endAt: null,
  };
}

function getPlacementFromPreview(previewMode: PreviewMode): HomePromoEntry["placement"] {
  if (previewMode === "popup") return "HOME_POPUP";
  if (previewMode === "product-card") return "HOME_PRODUCT_CARD";
  return "HOME_INLINE";
}

function IconActionButton({
  label,
  title,
  children,
  onClick,
  disabled,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <label className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">{label}</label>
      {hint ? (
        <span
          title={hint}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] text-zinc-500"
        >
          ?
        </span>
      ) : null}
    </div>
  );
}

function AccordionSection({ title, badge, open, onToggle, children }: AccordionSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/78 to-zinc-950/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-all duration-200 hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{title}</p>
          {badge ? <p className="mt-1 text-xs text-zinc-400">{badge}</p> : null}
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-zinc-300">
          {open ? "-" : "+"}
        </span>
      </button>

      {open ? <div className="border-t border-white/10 px-4 py-4">{children}</div> : null}
    </section>
  );
}

export default function AdminHomePromosPanel({
  locale,
  initialPromos,
  accentOptions,
  placementOptions,
  audienceOptions,
  lastUpdatedAt = null,
  lastUpdatedBy = null,
}: AdminHomePromosPanelProps) {
  const isFr = locale === "fr";
  const initialEntries =
    initialPromos.length > 0 ? initialPromos : [createDraftPromo(locale, accentOptions)];

  const [promos, setPromos] = useState<HomePromoEntry[]>(initialEntries);
  const [selectedPromoId, setSelectedPromoId] = useState<string>(initialEntries[0]?.id ?? "");
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    getPreviewVariant(initialEntries[0]?.placement ?? "HOME_INLINE")
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(lastUpdatedAt);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(lastUpdatedBy);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    content: true,
    targeting: false,
    settings: false,
    planning: false,
  });

  const selectedPromo = useMemo(
    () => promos.find((promo) => promo.id === selectedPromoId) ?? promos[0] ?? null,
    [promos, selectedPromoId]
  );

  const now = new Date();

  const selectedStatus = selectedPromo
    ? getPromoStatusMeta(locale, selectedPromo, now)
    : { label: "", className: "" };

  const selectedPlacementSummary = selectedPromo
    ? getPlacementContextDescription(locale, selectedPromo)
    : null;

  const previewPromo = useMemo(() => {
    if (!selectedPromo) {
      return null;
    }

    return {
      ...selectedPromo,
      placement: getPlacementFromPreview(previewMode),
    } satisfies HomePromoEntry;
  }, [previewMode, selectedPromo]);

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) {
      return isFr ? "Pas encore synchronise" : "Not synced yet";
    }

    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(lastSavedAt));
  }, [isFr, lastSavedAt, locale]);

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function selectPromo(promo: HomePromoEntry) {
    setSelectedPromoId(promo.id);
    setPreviewMode(getPreviewVariant(promo.placement));
    setFeedback(null);
  }

  function updateSelectedPromo<K extends keyof HomePromoEntry>(key: K, value: HomePromoEntry[K]) {
    setPromos((current) =>
      current.map((promo) => (promo.id === selectedPromoId ? { ...promo, [key]: value } : promo))
    );
  }

  function addPromo() {
    const nextPromo = createDraftPromo(locale, accentOptions);
    setPromos((current) => [nextPromo, ...current]);
    setSelectedPromoId(nextPromo.id);
    setPreviewMode(getPreviewVariant(nextPromo.placement));
    setFeedback(null);
    setOpenSections({ content: true, targeting: false, settings: false, planning: false });
  }

  function duplicateSelectedPromo() {
    if (!selectedPromo) {
      return;
    }

    const duplicate: HomePromoEntry = {
      ...selectedPromo,
      id: buildGeneratedPromoId(),
      title: `${selectedPromo.title} ${isFr ? "- Copie" : "- Copy"}`,
      enabled: false,
      startAt: null,
      endAt: null,
    };

    setPromos((current) => [duplicate, ...current]);
    setSelectedPromoId(duplicate.id);
    setPreviewMode(getPreviewVariant(duplicate.placement));
    setFeedback(isFr ? "Campagne dupliquee localement." : "Campaign duplicated locally.");
  }

  function removeSelectedPromo() {
    if (!selectedPromo) {
      return;
    }

    if (promos.length === 1) {
      const fallback = createDraftPromo(locale, accentOptions);
      setPromos([fallback]);
      setSelectedPromoId(fallback.id);
      setPreviewMode(getPreviewVariant(fallback.placement));
      setFeedback(isFr ? "Nouvelle base vide prete." : "Fresh blank campaign ready.");
      return;
    }

    const remaining = promos.filter((promo) => promo.id !== selectedPromo.id);
    setPromos(remaining);
    setSelectedPromoId(remaining[0]?.id ?? "");
    setPreviewMode(getPreviewVariant(remaining[0]?.placement ?? "HOME_INLINE"));
    setFeedback(isFr ? "Campagne retiree localement." : "Campaign removed locally.");
  }

  function toggleTargetStoreSlug(storeSlug: string) {
    if (!selectedPromo) {
      return;
    }

    const hasStore = selectedPromo.targetStoreSlugs.includes(storeSlug);
    updateSelectedPromo(
      "targetStoreSlugs",
      hasStore
        ? selectedPromo.targetStoreSlugs.filter((entry) => entry !== storeSlug)
        : [...selectedPromo.targetStoreSlugs, storeSlug]
    );
  }

  async function persistSelectedPromo(enabled: boolean) {
    if (!selectedPromo) {
      return;
    }

    const nextPromos = promos.map((promo) =>
      promo.id === selectedPromo.id ? { ...promo, enabled } : promo
    );

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/home-promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promos: nextPromos }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "SAVE_FAILED");
      }

      const normalizedEntries = Array.isArray(payload?.entries) ? payload.entries : nextPromos;
      setPromos(normalizedEntries);
      setSelectedPromoId((current) =>
        normalizedEntries.some((promo) => promo.id === current)
          ? current
          : (normalizedEntries[0]?.id ?? "")
      );
      setLastSavedAt(payload?.lastUpdatedAt ?? new Date().toISOString());
      setLastSavedBy(payload?.lastUpdatedBy ?? lastSavedBy ?? null);
      setFeedback(
        enabled
          ? isFr
            ? "Campagne publiee." 
            : "Campaign published."
          : isFr
            ? "Brouillon enregistre."
            : "Draft saved."
      );
    } catch (error) {
      setFeedback(
        isFr
          ? "Impossible de sauvegarder la campagne pour l'instant."
          : "We could not save the campaign right now."
      );
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  if (!selectedPromo || !previewPromo) {
    return null;
  }

  const inputClassName =
    "w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-emerald-300/35 focus:bg-black/30 focus:ring-2 focus:ring-emerald-400/12";
  const textareaClassName = `${inputClassName} min-h-[104px] resize-none`;
  const pillClassName =
    "inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-300 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08]";

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] xl:items-start">
      <div className="min-w-0 space-y-4 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:pr-1">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/78 to-zinc-950/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {isFr ? "Edition rapide" : "Quick editor"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {isFr ? "Creer campagne" : "Create campaign"}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {isFr
                  ? "L'essentiel a gauche, l'aperçu en direct a droite."
                  : "Keep essentials on the left and the live preview on the right."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/campaigns/dashboard"
                className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
              >
                {isFr ? "Dashboard campagnes" : "Campaign dashboard"}
              </Link>
              <button
                type="button"
                onClick={() => void persistSelectedPromo(false)}
                disabled={saving}
                className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-60"
              >
                {saving ? (isFr ? "Sauvegarde..." : "Saving...") : isFr ? "Brouillon" : "Draft"}
              </button>
              <button
                type="button"
                onClick={() => void persistSelectedPromo(true)}
                disabled={saving}
                className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 disabled:opacity-60"
              >
                {isFr ? "Publier" : "Publish"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-400">
              {feedback ? feedback : isFr ? "Selectionne une campagne pour la configurer." : "Select a campaign to configure it."}
            </div>
            <button
              type="button"
              onClick={addPromo}
              className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-400/15"
            >
              {isFr ? "+ Nouvelle campagne" : "+ New campaign"}
            </button>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {promos.map((promo) => {
              const isSelected = promo.id === selectedPromo.id;
              const statusMeta = getPromoStatusMeta(locale, promo, now);
              return (
                <button
                  key={promo.id}
                  type="button"
                  onClick={() => selectPromo(promo)}
                  className={`min-w-[220px] rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-emerald-300/30 bg-emerald-400/10 shadow-[0_16px_30px_rgba(16,185,129,0.12)]"
                      : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{promo.title}</p>
                      <p className="mt-1 truncate text-xs text-zinc-400">{promo.advertiserName}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {getPlacementLabel(locale, promo.placement)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/78 to-zinc-950/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-white">{selectedPromo.title}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${selectedStatus.className}`}>
                  {selectedStatus.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{selectedPlacementSummary}</p>
            </div>

            <div className="flex items-center gap-2">
              <IconActionButton
                label={isFr ? "Dupliquer la campagne" : "Duplicate campaign"}
                onClick={duplicateSelectedPromo}
              >
                ?
              </IconActionButton>
              <IconActionButton
                label={isFr ? "Supprimer la campagne" : "Delete campaign"}
                onClick={removeSelectedPromo}
              >
                ×
              </IconActionButton>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Audience" : "Audience"}</p>
              <p className="mt-2 text-sm font-medium text-white">{getAudienceLabel(locale, selectedPromo.audience)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Rotation" : "Rotation"}</p>
              <p className="mt-2 text-sm font-medium text-white">
                {selectedPromo.rotationSeconds ? `${selectedPromo.rotationSeconds}s` : isFr ? "Auto" : "Auto"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Derniere synchro" : "Last sync"}</p>
              <p className="mt-2 text-sm font-medium text-white">{lastSavedLabel}</p>
            </div>
          </div>
        </div>

        <AccordionSection
          title={isFr ? "Contenu" : "Content"}
          badge={isFr ? "Titre, message, visuels et CTA" : "Title, message, visuals, and CTA"}
          open={openSections.content}
          onToggle={() => toggleSection("content")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel label={isFr ? "Annonceur" : "Advertiser"} />
              <input
                className={inputClassName}
                value={selectedPromo.advertiserName}
                onChange={(event) => updateSelectedPromo("advertiserName", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Tag" : "Tag"} />
              <input
                className={inputClassName}
                value={selectedPromo.tag}
                onChange={(event) => updateSelectedPromo("tag", event.currentTarget.value)}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={isFr ? "Titre" : "Title"} />
              <input
                className={inputClassName}
                value={selectedPromo.title}
                onChange={(event) => updateSelectedPromo("title", event.currentTarget.value)}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={isFr ? "Texte" : "Copy"} />
              <textarea
                className={textareaClassName}
                value={selectedPromo.description}
                onChange={(event) => updateSelectedPromo("description", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "CTA" : "CTA"} />
              <input
                className={inputClassName}
                value={selectedPromo.cta}
                onChange={(event) => updateSelectedPromo("cta", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Lien cible" : "Target link"} />
              <input
                className={inputClassName}
                value={selectedPromo.href}
                onChange={(event) => updateSelectedPromo("href", event.currentTarget.value)}
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Image campagne" : "Campaign image"} />
              <input
                className={inputClassName}
                value={selectedPromo.imageUrl ?? ""}
                onChange={(event) => updateSelectedPromo("imageUrl", event.currentTarget.value || null)}
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Logo annonceur" : "Advertiser logo"} />
              <input
                className={inputClassName}
                value={selectedPromo.advertiserLogoUrl ?? ""}
                onChange={(event) => updateSelectedPromo("advertiserLogoUrl", event.currentTarget.value || null)}
              />
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          title={isFr ? "Ciblage" : "Targeting"}
          badge={isFr ? "Format, audience et verticales" : "Format, audience, and verticals"}
          open={openSections.targeting}
          onToggle={() => toggleSection("targeting")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel label={isFr ? "Format" : "Format"} />
              <select
                className={inputClassName}
                value={selectedPromo.placement}
                onChange={(event) => {
                  const nextPlacement = event.currentTarget.value as HomePromoEntry["placement"];
                  updateSelectedPromo("placement", nextPlacement);
                  setPreviewMode(getPreviewVariant(nextPlacement));
                }}
              >
                {placementOptions.map((placement) => (
                  <option key={placement} value={placement}>
                    {getPlacementLabel(locale, placement)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel label={isFr ? "Audience" : "Audience"} />
              <div className="flex flex-wrap gap-2">
                {audienceOptions.map((audience) => {
                  const isActive = selectedPromo.audience === audience;
                  return (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => updateSelectedPromo("audience", audience)}
                      className={`rounded-full px-3 py-2 text-sm transition-all duration-200 ${
                        isActive
                          ? "border border-emerald-300/25 bg-emerald-400/12 text-emerald-100"
                          : pillClassName
                      }`}
                    >
                      {getAudienceLabel(locale, audience)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2">
              <FieldLabel
                label={isFr ? "Verticales" : "Verticals"}
                hint={isFr ? "Laisse vide pour diffuser partout." : "Leave empty to deliver everywhere."}
              />
              <div className="flex flex-wrap gap-2">
                {targetingOptions.map((option) => {
                  const active = selectedPromo.targetStoreSlugs.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleTargetStoreSlug(option.value)}
                      className={`rounded-full px-3 py-2 text-sm transition-all duration-200 ${
                        active
                          ? "border border-amber-300/25 bg-amber-400/12 text-amber-100"
                          : pillClassName
                      }`}
                    >
                      {isFr ? option.fr : option.en}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          title={isFr ? "Parametres" : "Settings"}
          badge={isFr ? "Priorite, rotation et limites" : "Priority, rotation, and limits"}
          open={openSections.settings}
          onToggle={() => toggleSection("settings")}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel label={isFr ? "Priorite" : "Priority"} />
              <input
                type="number"
                min={0}
                max={999}
                className={inputClassName}
                value={selectedPromo.priority}
                onChange={(event) => updateSelectedPromo("priority", Number(event.currentTarget.value) || 0)}
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Rotation (s)" : "Rotation (s)"} />
              <input
                type="number"
                min={3}
                max={60}
                className={inputClassName}
                value={selectedPromo.rotationSeconds ?? ""}
                onChange={(event) =>
                  updateSelectedPromo(
                    "rotationSeconds",
                    event.currentTarget.value ? Number(event.currentTarget.value) : null
                  )
                }
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Couleur" : "Accent"} />
              <select
                className={inputClassName}
                value={selectedPromo.accentClassName}
                onChange={(event) => updateSelectedPromo("accentClassName", event.currentTarget.value)}
              >
                {accentOptions.map((accent, index) => (
                  <option key={accent} value={accent}>
                    {isFr ? `Palette ${index + 1}` : `Palette ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-white">
              {isFr ? "Parametres avances" : "Advanced settings"}
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label={isFr ? "Label sponsorise" : "Sponsored label"} />
                <input
                  className={inputClassName}
                  value={selectedPromo.sponsoredLabel}
                  onChange={(event) => updateSelectedPromo("sponsoredLabel", event.currentTarget.value)}
                />
              </div>
              <div>
                <FieldLabel label={isFr ? "Cap impression" : "Impression cap"} />
                <input
                  type="number"
                  min={1}
                  max={999}
                  className={inputClassName}
                  value={selectedPromo.impressionCap ?? ""}
                  onChange={(event) =>
                    updateSelectedPromo(
                      "impressionCap",
                      event.currentTarget.value ? Number(event.currentTarget.value) : null
                    )
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selectedPromo.openInNewTab}
                    onChange={(event) => updateSelectedPromo("openInNewTab", event.currentTarget.checked)}
                  />
                  {isFr ? "Ouvrir le lien dans un nouvel onglet" : "Open the link in a new tab"}
                </label>
              </div>
            </div>
          </details>
        </AccordionSection>

        <AccordionSection
          title={isFr ? "Planning" : "Planning"}
          badge={isFr ? "Fenetre de diffusion" : "Delivery window"}
          open={openSections.planning}
          onToggle={() => toggleSection("planning")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel label={isFr ? "Debut" : "Start"} />
              <input
                type="datetime-local"
                className={inputClassName}
                value={toDateTimeLocalValue(selectedPromo.startAt)}
                onChange={(event) =>
                  updateSelectedPromo("startAt", fromDateTimeLocalValue(event.currentTarget.value))
                }
              />
            </div>
            <div>
              <FieldLabel label={isFr ? "Fin" : "End"} />
              <input
                type="datetime-local"
                className={inputClassName}
                value={toDateTimeLocalValue(selectedPromo.endAt)}
                onChange={(event) =>
                  updateSelectedPromo("endAt", fromDateTimeLocalValue(event.currentTarget.value))
                }
              />
            </div>
          </div>
        </AccordionSection>
      </div>

      <aside className="min-w-0 self-start xl:sticky xl:top-24">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/78 to-zinc-950/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {isFr ? "Preview live" : "Live preview"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {isFr ? "Apercu campagne" : "Campaign preview"}
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
              {getPlacementLabel(locale, previewPromo.placement)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ["popup", isFr ? "Popup" : "Popup"],
              ["inline", isFr ? "Bandeau" : "Banner"],
              ["product-card", isFr ? "Carte" : "Card"],
            ] as const).map(([mode, label]) => {
              const active = previewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-full px-3 py-2 text-sm transition-all duration-200 ${
                    active
                      ? "border border-emerald-300/25 bg-emerald-400/12 text-emerald-100"
                      : pillClassName
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-black/20 p-3">
            {previewMode === "popup" ? (
              <div className={`overflow-hidden rounded-[1.6rem] border bg-gradient-to-br ${previewPromo.accentClassName} p-4 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.55)]`}>
                <SponsoredPlacement
                  locale={locale}
                  promo={previewPromo}
                  variant="popup"
                  trackEvents={false}
                />
              </div>
            ) : (
              <SponsoredPlacement
                locale={locale}
                promo={previewPromo}
                variant={previewMode}
                trackEvents={false}
              />
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Diffusion" : "Delivery"}</p>
              <p className="mt-2 text-sm text-zinc-200">{selectedPlacementSummary}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isFr ? "Verticales" : "Verticals"}</p>
              <p className="mt-2 text-sm text-zinc-200">
                {selectedPromo.targetStoreSlugs.length > 0
                  ? selectedPromo.targetStoreSlugs.join(", ")
                  : isFr
                    ? "Toutes les verticales"
                    : "All verticals"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-400">
            <div className="flex items-center justify-between gap-3">
              <span>{isFr ? "Derniere synchro" : "Last sync"}</span>
              <span className="text-zinc-200">{lastSavedLabel}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>{isFr ? "Par" : "By"}</span>
              <span className="truncate text-zinc-200">{lastSavedBy ?? (isFr ? "Admin JONTAADO" : "JONTAADO admin")}</span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
