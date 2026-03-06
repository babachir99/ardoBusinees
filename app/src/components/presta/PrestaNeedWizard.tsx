"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type Props = {
  locale: string;
  open: boolean;
  compact?: boolean;
  needTitle: string;
  needDescription: string;
  needCity: string;
  needArea: string;
  needBudget: string;
  needCurrency: string;
  needPreferredDate: string;
  setNeedTitle: (value: string) => void;
  setNeedDescription: (value: string) => void;
  setNeedCity: (value: string) => void;
  setNeedArea: (value: string) => void;
  setNeedBudget: (value: string) => void;
  setNeedCurrency: (value: string) => void;
  setNeedPreferredDate: (value: string) => void;
  submittingNeed: boolean;
  needError: string | null;
  needSuccess: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function PrestaNeedWizard({
  locale,
  open,
  compact = false,
  needTitle,
  needDescription,
  needCity,
  needArea,
  needBudget,
  needCurrency,
  needPreferredDate,
  setNeedTitle,
  setNeedDescription,
  setNeedCity,
  setNeedArea,
  setNeedBudget,
  setNeedCurrency,
  setNeedPreferredDate,
  submittingNeed,
  needError,
  needSuccess,
  onSubmit,
}: Props) {
  const isFr = locale === "fr";
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const steps = useMemo(
    () => [
      isFr ? "Service" : "Service",
      isFr ? "Lieu & Budget" : "Location & Budget",
      isFr ? "Details" : "Details",
      isFr ? "Publier" : "Publish",
    ],
    [isFr]
  );

  const suggestions = useMemo(
    () =>
      isFr
        ? ["Menage", "Plomberie", "Electricite", "Montage meubles", "Livraison"]
        : ["Cleaning", "Plumbing", "Electricity", "Furniture assembly", "Delivery"],
    [isFr]
  );

  const canContinueStep1 = needTitle.trim().length > 0;
  const canContinueStep2 = needCity.trim().length > 0;
  const progress = (step / steps.length) * 100;

  return (
    <div className={compact ? "w-full" : "mx-auto w-full max-w-2xl"}>
      <form
        onSubmit={onSubmit}
        className={
          compact
            ? "space-y-0"
            : "rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/20 md:p-8"
        }
      >
        {!compact ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              {isFr ? "Assistant besoin" : "Need wizard"}
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              {isFr ? "Creer un besoin en quelques etapes" : "Create a need in a few steps"}
            </h3>
          </div>
        ) : null}

        <div className="hidden items-center justify-between gap-2 md:flex">
          {steps.map((label, index) => {
            const stepIndex = index + 1;
            const active = step === stepIndex;
            const done = step > stepIndex;

            return (
              <div key={label} className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                    active || done
                      ? "bg-emerald-500 text-black"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {stepIndex}
                </span>
                <span
                  className={`truncate text-xs ${
                    active ? "text-emerald-300" : "text-zinc-500"
                  }`}
                >
                  {label}
                </span>
                {index < steps.length - 1 ? (
                  <span className="mx-1 h-px w-6 bg-zinc-700" />
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-zinc-400 md:hidden">
          {isFr ? `Etape ${step} sur ${steps.length}` : `Step ${step} of ${steps.length}`}
        </p>

        <div className="mt-3 h-2 rounded-full bg-zinc-800">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          key={step}
          className="mt-6 translate-x-0 opacity-100 transition-all duration-300"
        >
          {step === 1 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-white">
                  {isFr
                    ? "Quel service recherchez-vous ?"
                    : "Which service are you looking for?"}
                </h4>
                <input
                  value={needTitle}
                  onChange={(event) => setNeedTitle(event.target.value)}
                  placeholder={
                    isFr ? "Ex: Montage meuble IKEA" : "e.g. IKEA furniture assembly"
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-lg text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setNeedTitle(suggestion)}
                    className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-400/40 hover:text-white active:scale-95"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFr ? "Continuer" : "Continue"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <h4 className="text-base font-semibold text-white">
                {isFr ? "Ou et pour quel budget ?" : "Where and what budget?"}
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-300">
                  {isFr ? "Ville" : "City"}
                  <input
                    value={needCity}
                    onChange={(event) => setNeedCity(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-300">
                  {isFr ? "Zone" : "Area"}
                  <input
                    value={needArea}
                    onChange={(event) => setNeedArea(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-300">
                  {isFr ? "Budget" : "Budget"}
                  <input
                    value={needBudget}
                    onChange={(event) => setNeedBudget(event.target.value)}
                    type="number"
                    min={0}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-300">
                  {isFr ? "Devise" : "Currency"}
                  <select
                    value={needCurrency}
                    onChange={(event) => setNeedCurrency(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="XOF">XOF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white active:scale-95"
                >
                  {isFr ? "Retour" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canContinueStep2}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFr ? "Continuer" : "Continue"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <h4 className="text-base font-semibold text-white">
                {isFr ? "Ajoutez quelques details" : "Add a few details"}
              </h4>

              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                {isFr ? "Description" : "Description"}
                <textarea
                  value={needDescription}
                  onChange={(event) => setNeedDescription(event.target.value)}
                  maxLength={3000}
                  placeholder={
                    isFr
                      ? "Decrivez rapidement votre besoin..."
                      : "Briefly describe your need..."
                  }
                  className="h-28 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                {isFr ? "Date souhaitee" : "Preferred date"}
                <input
                  type="date"
                  value={needPreferredDate}
                  onChange={(event) => setNeedPreferredDate(event.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white transition-all duration-200 hover:border-emerald-400/30 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <p className="text-xs text-zinc-400">
                {isFr
                  ? "Quelques details aident les prestataires a mieux vous repondre."
                  : "A few details help providers reply more accurately."}
              </p>

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white active:scale-95"
                >
                  {isFr ? "Retour" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-600 active:scale-95"
                >
                  {isFr ? "Continuer" : "Continue"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <h4 className="text-base font-semibold text-white">
                {isFr ? "Confirmation" : "Review"}
              </h4>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    {isFr ? "Service" : "Service"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">{needTitle || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    {isFr ? "Lieu" : "Location"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">
                    {needCity || "-"}{needArea ? `, ${needArea}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    {isFr ? "Budget" : "Budget"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">
                    {needBudget ? `${needBudget} ${needCurrency}` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    {isFr ? "Date souhaitee" : "Preferred date"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">{needPreferredDate || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    {isFr ? "Description" : "Description"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-100">{needDescription || "-"}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white active:scale-95"
                >
                  {isFr ? "Retour" : "Back"}
                </button>
                <button
                  type="submit"
                  disabled={submittingNeed}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingNeed
                    ? isFr
                      ? "Publication..."
                      : "Publishing..."
                    : isFr
                      ? "Publier mon besoin"
                      : "Publish my need"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {needError ? <p className="mt-4 text-sm text-rose-300">{needError}</p> : null}
        {needSuccess ? <p className="mt-4 text-sm text-emerald-300">{needSuccess}</p> : null}
      </form>
    </div>
  );
}
