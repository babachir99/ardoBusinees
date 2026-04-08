"use client";

import { useMemo } from "react";
import RotatingSponsoredPlacement from "@/components/ads/RotatingSponsoredPlacement";
import SponsoredPlacement from "@/components/ads/SponsoredPlacement";
import type { HomePromoEntry } from "@/lib/homePromos.shared";
import type { HomePromoTrackingSummary } from "@/lib/homePromos";
import {
  buildDemoPreviewPromos,
  getPlacementContextDescription,
  getPlacementLabel,
  getPreviewVariant,
  getPromoLifecycleStatus,
  homepageFormatPlacements,
} from "@/components/admin/homePromoAdminShared";

type AdminCampaignsDashboardProps = {
  locale: string;
  promos: HomePromoEntry[];
  trackingSummary: HomePromoTrackingSummary;
  accentOptions: string[];
  placementOptions: HomePromoEntry["placement"][];
};

export default function AdminCampaignsDashboard({
  locale,
  promos,
  trackingSummary,
  accentOptions,
  placementOptions,
}: AdminCampaignsDashboardProps) {
  const isFr = locale === "fr";
  const now = useMemo(() => new Date(), []);

  const demoPreviewPromos = useMemo(
    () => buildDemoPreviewPromos(locale, accentOptions),
    [accentOptions, locale]
  );

  const placementStats = useMemo(() => {
    return placementOptions.map((placement) => {
      const placementPromos = promos.filter((promo) => promo.placement === placement);
      const livePromos = placementPromos.filter((promo) => getPromoLifecycleStatus(promo, now) === "live");
      const aggregate = placementPromos.reduce(
        (accumulator, promo) => {
          const stats = trackingSummary.byPromoId[promo.id];
          if (!stats) {
            return accumulator;
          }

          accumulator.impressions += stats.impressions;
          accumulator.clicks += stats.clicks;
          accumulator.anonymousImpressions += stats.anonymousImpressions;
          return accumulator;
        },
        {
          impressions: 0,
          clicks: 0,
          anonymousImpressions: 0,
        }
      );

      return {
        placement,
        configuredCount: placementPromos.length,
        liveCount: livePromos.length,
        impressions: aggregate.impressions,
        clicks: aggregate.clicks,
        anonymousImpressions: aggregate.anonymousImpressions,
        ctr:
          aggregate.impressions > 0
            ? Math.round((aggregate.clicks / aggregate.impressions) * 1000) / 10
            : 0,
      };
    });
  }, [now, placementOptions, promos, trackingSummary.byPromoId]);

  const liveRotationPreviews = useMemo(() => {
    return homepageFormatPlacements.map((placement) => {
      const activePromos = promos.filter(
        (promo) => promo.placement === placement && getPromoLifecycleStatus(promo, now) === "live"
      );

      return {
        placement,
        promos: activePromos.length > 0 ? activePromos : [demoPreviewPromos[placement]],
        usingFallback: activePromos.length === 0,
      };
    });
  }, [demoPreviewPromos, now, promos]);

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/70 to-zinc-950/65 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] md:p-5">
      <div className="grid gap-3 md:grid-cols-4">
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
            className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 xl:grid-cols-4">
        {placementStats.map((item) => (
          <div
            key={item.placement}
            className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  {getPlacementLabel(locale, item.placement)}
                </p>
                <p className="mt-2 text-xl font-semibold text-white">{item.impressions}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-300">
                {item.liveCount}/{item.configuredCount} {isFr ? "live" : "live"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  {isFr ? "Clics" : "Clicks"}
                </p>
                <p className="mt-1 font-semibold text-white">{item.clicks}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">CTR</p>
                <p className="mt-1 font-semibold text-white">{item.ctr}%</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  {isFr ? "Invites" : "Guests"}
                </p>
                <p className="mt-1 font-semibold text-white">{item.anonymousImpressions}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">
              {isFr ? "Formats homepage" : "Homepage formats"}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {isFr
                ? "Les trois formats principaux restent visibles ici pour valider l'usage attendu."
                : "Keep the three main formats visible here to validate the intended use."}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-1">
            {homepageFormatPlacements.map((placement) => (
              <div
                key={`example-${placement}`}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
              >
                <div className="mb-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {getPlacementLabel(locale, placement)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {getPlacementContextDescription(locale, demoPreviewPromos[placement])}
                  </p>
                </div>

                {placement === "HOME_POPUP" ? (
                  <div
                    className={`overflow-hidden rounded-[1.7rem] border bg-gradient-to-br ${demoPreviewPromos[placement].accentClassName} p-4 shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl`}
                  >
                    <SponsoredPlacement
                      locale={locale}
                      promo={demoPreviewPromos[placement]}
                      variant="popup"
                      trackEvents={false}
                    />
                  </div>
                ) : (
                  <SponsoredPlacement
                    locale={locale}
                    promo={demoPreviewPromos[placement]}
                    variant={getPreviewVariant(placement)}
                    trackEvents={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">
              {isFr ? "Rotation live par slot" : "Live rotation by slot"}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {isFr
                ? "On affiche ici ce qui tourne reellement. S'il n'y a rien en live, on garde un exemple."
                : "This shows what actually rotates. If nothing is live yet, a demo stays visible."}
            </p>
          </div>

          <div className="grid gap-4">
            {liveRotationPreviews.map((preview) => (
              <div
                key={`rotation-${preview.placement}`}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      {getPlacementLabel(locale, preview.placement)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {preview.usingFallback
                        ? isFr
                          ? "Aucune campagne live pour ce format. Apercu demo affiche."
                          : "No live campaign for this format yet. Demo preview shown."
                        : isFr
                          ? `${preview.promos.length} campagne(s) tournent dans ce slot.`
                          : `${preview.promos.length} campaign(s) rotate in this slot.`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
                    {preview.promos[0]?.rotationSeconds
                      ? isFr
                        ? `${preview.promos[0].rotationSeconds}s / pub`
                        : `${preview.promos[0].rotationSeconds}s / ad`
                      : isFr
                        ? "Rotation auto"
                        : "Auto rotation"}
                  </span>
                </div>

                <RotatingSponsoredPlacement
                  locale={locale}
                  promos={preview.promos}
                  variant={getPreviewVariant(preview.placement)}
                  trackEvents={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

