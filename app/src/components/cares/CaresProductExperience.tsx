"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import {
  marketplaceActionPrimaryClass,
  marketplaceActionSecondaryClass,
} from "@/components/marketplace/MarketplaceActions";
import MarketplaceActions from "@/components/marketplace/MarketplaceActions";

type JourneyField = {
  label: string;
  value: string;
};

type Journey = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  cta: string;
  panelTitle: string;
  panelDescription: string;
  previewFields: JourneyField[];
  statusPath: string[];
  opsBullets: string[];
  footerNote: string;
  panelPrimary: string;
};

type UseCase = {
  title: string;
  subtitle: string;
  description: string;
  chips: string[];
};

type StatusColumn = {
  title: string;
  tone: string;
  items: string[];
};

type WhyCard = {
  title: string;
  description: string;
};

type TrustCard = {
  title: string;
  items: string[];
};

type DataModel = {
  title: string;
  subtitle: string;
  description: string;
  chips: string[];
  states: string[];
};

export type CaresPageContent = {
  kicker: string;
  title: string;
  subtitle: string;
  preprod: string;
  ctas: Array<{ label: string; href: string }>;
  explainerTitle: string;
  explainerBody: string;
  chips: string[];
  metrics: Array<{ value: string; label: string; detail: string }>;
  heroHighlights: string[];
  aboutButtonLabel: string;
  aboutButtonHint: string;
  useCasesTitle: string;
  useCasesSubtitle: string;
  useCases: UseCase[];
  productTitle: string;
  productSubtitle: string;
  journeys: Journey[];
  modelsTitle: string;
  modelsSubtitle: string;
  models: DataModel[];
  statusesTitle: string;
  statusesSubtitle: string;
  statusColumns: StatusColumn[];
  whyTitle: string;
  whyCards: WhyCard[];
  trustTitle: string;
  trustCards: TrustCard[];
  specKicker: string;
  specTitle: string;
  specBody: string;
  specCaption: string;
  nextTitle: string;
  nextBody: string;
  nextCta: string;
  panelKicker: string;
  panelClose: string;
  panelPreviewTitle: string;
  panelStatusTitle: string;
  panelOpsTitle: string;
  panelFootnoteTitle: string;
  aboutPanelTitle: string;
  aboutPanelBody: string;
};

const toneClasses: Record<string, string> = {
  emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
  cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
  amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
};

export default function CaresProductExperience({
  page,
  locale = "fr",
}: {
  page: CaresPageContent;
  locale?: "fr" | "en";
}) {
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const activeJourney = useMemo(
    () => page.journeys.find((journey) => journey.id === activeJourneyId) ?? null,
    [activeJourneyId, page.journeys]
  );

  useEffect(() => {
    if (!activeJourney && !aboutOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveJourneyId(null);
        setAboutOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeJourney, aboutOpen]);

  const openJourney = (journeyId: string) => {
    setAboutOpen(false);
    setActiveJourneyId(journeyId);
  };

  return (
    <>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={locale === "fr" ? "Donner, offrir ou demander de l'aide" : "Give, offer, or ask for help"}
          compact
          accentClassName="from-emerald-500/18 via-zinc-950/92 to-zinc-950"
        />

        <MarketplaceActions
          left={
            <>
              {page.journeys.map((journey, index) => (
                <button
                  key={journey.id}
                  type="button"
                    onClick={() => openJourney(journey.id)}
                    className={
                      (activeJourneyId ?? page.journeys[0]?.id) === journey.id
                        ? marketplaceActionPrimaryClass
                        : marketplaceActionSecondaryClass
                    }
                  >
                    {page.ctas[index]?.label ?? journey.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActiveJourneyId(null);
                  setAboutOpen(true);
                }}
                className={marketplaceActionSecondaryClass}
              >
                {page.aboutButtonLabel}
              </button>
            </>
          }
        />

        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[1.8rem] border border-white/10 bg-zinc-900/65 p-5 backdrop-blur-sm">
            <Image
              src="/stores/last_cares.png"
              alt="JONTAADO CARES logo"
              width={760}
              height={340}
              className="mx-auto h-auto w-full max-w-[240px] object-contain"
              priority
            />
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-zinc-900/65 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
              {page.explainerTitle}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">{page.explainerBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {page.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-emerald-300/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100"
                >
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-500">{page.aboutButtonHint}</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
              {page.useCasesTitle}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
              {page.useCasesSubtitle}
            </p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {page.useCases.map((useCase, index) => (
              <article
                key={useCase.title}
                className="rounded-[1.6rem] border border-white/10 bg-zinc-950/65 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {useCase.subtitle}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">{useCase.title}</h2>
                  </div>
                  <span className="text-lg font-semibold text-zinc-500">0{index + 1}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{useCase.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {useCase.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-200"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
              {page.productTitle}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
              {page.productSubtitle}
            </p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {page.journeys.map((journey, index) => (
              <article
                id={journey.id}
                key={journey.id}
                className="group flex h-full flex-col rounded-[1.6rem] border border-white/10 bg-zinc-950/65 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:shadow-[0_18px_60px_-35px_rgba(34,197,94,0.4)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                    {journey.eyebrow}
                  </span>
                  <span className="text-lg font-semibold text-zinc-500">0{index + 1}</span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white">{journey.label}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{journey.description}</p>
                <ul className="mt-5 space-y-3 text-sm text-zinc-200">
                  {journey.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 leading-6"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {page.preprod}
                  </span>
                  <button
                    type="button"
                    onClick={() => openJourney(journey.id)}
                    className={marketplaceActionSecondaryClass}
                  >
                    {journey.cta}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(16,24,39,0.94),rgba(7,17,12,0.98))] p-6 shadow-[0_24px_70px_-45px_rgba(34,197,94,0.5)] md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                {page.nextTitle}
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">{page.nextBody}</p>
            </div>
            <Link
              href="/stores"
              className="inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            >
              {page.nextCta}
            </Link>
          </div>
        </section>
      </main>

      {activeJourney ? (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setActiveJourneyId(null)}
          aria-hidden={false}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={activeJourney.label}
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[1.8rem] border border-white/10 bg-zinc-950/96 shadow-2xl transition-all duration-300 motion-reduce:transition-none md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[480px] md:max-w-[92vw] md:rounded-none md:rounded-l-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                    {page.panelKicker}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{activeJourney.panelTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{activeJourney.panelDescription}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveJourneyId(null)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-white/40"
                >
                  {page.panelClose}
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
                <section className="rounded-2xl border border-emerald-300/15 bg-emerald-400/8 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    {page.panelPreviewTitle}
                  </p>
                  <div className="mt-3 grid gap-3">
                    {activeJourney.previewFields.map((field) => (
                      <div
                        key={field.label}
                        className="rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3"
                      >
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {field.label}
                        </p>
                        <p className="mt-1 text-sm font-medium text-zinc-100">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    {page.panelStatusTitle}
                  </p>
                  <div className="mt-4 space-y-3">
                    {activeJourney.statusPath.map((status, index) => (
                      <div key={status} className="flex items-center gap-3">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-xs font-semibold text-emerald-100">
                          {index + 1}
                        </span>
                        <div className="flex-1 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100">
                          {status}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    {page.panelOpsTitle}
                  </p>
                  <div className="mt-3 space-y-2">
                    {activeJourney.opsBullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-zinc-200"
                      >
                        {bullet}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/8 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                    {page.panelFootnoteTitle}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">{activeJourney.footerNote}</p>
                </section>
              </div>

              <div className="border-t border-white/10 bg-zinc-950/90 px-5 py-4 md:px-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
                  >
                    {activeJourney.panelPrimary}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveJourneyId(null)}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-zinc-900/70 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-white/35"
                  >
                    {page.panelClose}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {aboutOpen ? (
        <div className="fixed inset-0 z-50" onClick={() => setAboutOpen(false)} aria-hidden={false}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={page.aboutPanelTitle}
            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden rounded-t-[1.8rem] border border-white/10 bg-zinc-950/96 shadow-2xl transition-all duration-300 motion-reduce:transition-none md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[560px] md:max-w-[94vw] md:rounded-none md:rounded-l-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                    {page.specKicker}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{page.aboutPanelTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{page.aboutPanelBody}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAboutOpen(false)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-white/40"
                >
                  {page.panelClose}
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
                <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-2 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.45)]">
                    <Image
                      src="/stores/cares-spec.png"
                      alt="Cahier des charges JONTAADO CARES"
                      width={1200}
                      height={1700}
                      className="h-auto w-full rounded-xl object-cover"
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{page.specCaption}</p>
                  <div className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/8 p-4">
                    <h3 className="text-base font-semibold text-white">{page.specTitle}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{page.specBody}</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                  <h3 className="text-base font-semibold text-white">{page.modelsTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{page.modelsSubtitle}</p>
                  <div className="mt-4 grid gap-3">
                    {page.models.map((model) => (
                      <article key={model.title} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {model.subtitle}
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-white">{model.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{model.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {model.chips.map((chip) => (
                            <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-200">
                              {chip}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                  <h3 className="text-base font-semibold text-white">{page.statusesTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{page.statusesSubtitle}</p>
                  <div className="mt-4 grid gap-3">
                    {page.statusColumns.map((column) => (
                      <article key={column.title} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                        <h4 className="text-base font-semibold text-white">{column.title}</h4>
                        <div className="mt-3 space-y-2">
                          {column.items.map((item, index) => (
                            <div key={item} className="flex items-center gap-3">
                              <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${toneClasses[column.tone]}`}>
                                {index + 1}
                              </span>
                              <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
                                {item}
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                    <h3 className="text-base font-semibold text-white">{page.whyTitle}</h3>
                    <div className="mt-4 space-y-3">
                      {page.whyCards.map((card) => (
                        <div key={card.title} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                          <h4 className="text-sm font-semibold text-white">{card.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">{card.description}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                    <h3 className="text-base font-semibold text-white">{page.trustTitle}</h3>
                    <div className="mt-4 space-y-3">
                      {page.trustCards.map((card) => (
                        <div key={card.title} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                          <h4 className="text-sm font-semibold text-white">{card.title}</h4>
                          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                            {card.items.map((item) => (
                              <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 leading-6">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
