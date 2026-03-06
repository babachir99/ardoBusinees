"use client";

import { useMemo, useState } from "react";

export type PrestaSortValue = "recommended" | "priceAsc" | "priceDesc" | "newest";

export type PrestaFiltersValue = {
  query: string;
  city: string;
  category: string;
  budgetMin: string;
  budgetMax: string;
  sort: PrestaSortValue;
};

type Props = {
  locale: string;
  value: PrestaFiltersValue;
  cities: string[];
  categories: string[];
  onChange: (next: Partial<PrestaFiltersValue>) => void;
  onReset: () => void;
};

export default function PrestaFiltersBar({
  locale,
  value,
  cities,
  categories,
  onChange,
  onReset,
}: Props) {
  const isFr = locale === "fr";
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filtersPulse, setFiltersPulse] = useState(false);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: keyof PrestaFiltersValue; label: string }> = [];
    if (value.query.trim()) chips.push({ key: "query", label: `${isFr ? "Recherche" : "Search"}: ${value.query.trim()}` });
    if (value.city) chips.push({ key: "city", label: `${isFr ? "Ville" : "City"}: ${value.city}` });
    if (value.category) {
      chips.push({ key: "category", label: `${isFr ? "Categorie" : "Category"}: ${value.category}` });
    }
    if (value.budgetMin) {
      chips.push({ key: "budgetMin", label: `${isFr ? "Min" : "Min"}: ${value.budgetMin}` });
    }
    if (value.budgetMax) {
      chips.push({ key: "budgetMax", label: `${isFr ? "Max" : "Max"}: ${value.budgetMax}` });
    }
    if (value.sort !== "recommended") {
      chips.push({
        key: "sort",
        label:
          value.sort === "priceAsc"
            ? isFr
              ? "Prix croissant"
              : "Price low to high"
            : value.sort === "priceDesc"
              ? isFr
                ? "Prix decroissant"
                : "Price high to low"
              : isFr
                ? "Nouveaux"
                : "Newest",
      });
    }
    return chips;
  }, [isFr, value]);

  const triggerFiltersPulse = () => {
    setFiltersPulse(true);
    window.setTimeout(() => setFiltersPulse(false), 220);
  };

  const handleChange = (next: Partial<PrestaFiltersValue>) => {
    onChange(next);
    triggerFiltersPulse();
  };

  return (
    <section className="sticky top-20 z-20 space-y-3">
      <div className="relative flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-5 transition-all duration-200 focus-within:scale-[1.01] focus-within:border-emerald-500 focus-within:shadow-lg focus-within:shadow-emerald-500/20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5 text-zinc-500"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={value.query}
          onChange={(event) => handleChange({ query: event.target.value })}
          placeholder={isFr ? "Quel service recherchez-vous ?" : "Which service are you looking for?"}
          className="flex-1 bg-transparent text-lg text-white outline-none"
        />
        <button
          type="button"
          onClick={() => handleChange({ query: value.query.trim() })}
          className="rounded-xl bg-emerald-500 px-5 py-2 font-medium text-black transition hover:bg-emerald-600 active:scale-95"
        >
          {isFr ? "Rechercher" : "Search"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowMobileFilters((current) => !current)}
        className="inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:border-emerald-400/40 md:hidden"
      >
        {isFr ? "Filtres" : "Filters"}
      </button>

      <div className={`${showMobileFilters ? "block" : "hidden"} md:block`}>
        <div
          className={`grid grid-cols-2 gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-3 xl:grid-cols-6 ${filtersPulse ? "animate-pulse" : ""}`}
        >
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Ville" : "City"}
            <select
              value={value.city}
              onChange={(event) => handleChange({ city: event.target.value })}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white transition hover:border-emerald-400/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            >
              <option value="">{isFr ? "Toutes" : "All"}</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Categorie" : "Category"}
            <select
              value={value.category}
              onChange={(event) => handleChange({ category: event.target.value })}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white transition hover:border-emerald-400/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            >
              <option value="">{isFr ? "Toutes" : "All"}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Budget min" : "Min budget"}
            <input
              value={value.budgetMin}
              type="number"
              min={0}
              onChange={(event) => handleChange({ budgetMin: event.target.value })}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white transition hover:border-emerald-400/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Budget max" : "Max budget"}
            <input
              value={value.budgetMax}
              type="number"
              min={0}
              onChange={(event) => handleChange({ budgetMax: event.target.value })}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white transition hover:border-emerald-400/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Tri" : "Sort"}
            <select
              value={value.sort}
              onChange={(event) => handleChange({ sort: event.target.value as PrestaSortValue })}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white transition hover:border-emerald-400/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            >
              <option value="recommended">{isFr ? "Recommande" : "Recommended"}</option>
              <option value="priceAsc">{isFr ? "Prix croissant" : "Price asc"}</option>
              <option value="priceDesc">{isFr ? "Prix decroissant" : "Price desc"}</option>
              <option value="newest">{isFr ? "Nouveaux" : "Newest"}</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60"
            >
              {isFr ? "Reinitialiser" : "Reset"}
            </button>
          </div>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}-${chip.label}`}
              type="button"
              onClick={() =>
                onChange(
                  chip.key === "sort"
                    ? { sort: "recommended" }
                    : {
                        [chip.key]: "",
                      }
                )
              }
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-[11px] text-zinc-300 transition hover:border-white/35"
            >
              <span>{chip.label}</span>
              <span className="text-zinc-500">x</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
