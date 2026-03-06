"use client";

import { useMemo } from "react";

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

  return (
    <section className="sticky top-20 z-20 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.32)]">
      <div className="flex flex-wrap gap-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-zinc-400">
          {isFr ? "Recherche" : "Search"}
          <input
            value={value.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder={isFr ? "Service, mot cle..." : "Service, keyword..."}
            className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
          />
        </label>

        <label className="flex min-w-[170px] flex-col gap-1 text-xs text-zinc-400">
          {isFr ? "Ville" : "City"}
          <select
            value={value.city}
            onChange={(event) => onChange({ city: event.target.value })}
            className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
          >
            <option value="">{isFr ? "Toutes" : "All"}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[170px] flex-col gap-1 text-xs text-zinc-400">
          {isFr ? "Categorie" : "Category"}
          <select
            value={value.category}
            onChange={(event) => onChange({ category: event.target.value })}
            className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
          >
            <option value="">{isFr ? "Toutes" : "All"}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div className="grid min-w-[230px] grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Budget min" : "Min budget"}
            <input
              value={value.budgetMin}
              type="number"
              min={0}
              onChange={(event) => onChange({ budgetMin: event.target.value })}
              className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {isFr ? "Budget max" : "Max budget"}
            <input
              value={value.budgetMax}
              type="number"
              min={0}
              onChange={(event) => onChange({ budgetMax: event.target.value })}
              className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
            />
          </label>
        </div>

        <label className="flex min-w-[170px] flex-col gap-1 text-xs text-zinc-400">
          {isFr ? "Tri" : "Sort"}
          <select
            value={value.sort}
            onChange={(event) => onChange({ sort: event.target.value as PrestaSortValue })}
            className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
          >
            <option value="recommended">{isFr ? "Recommande" : "Recommended"}</option>
            <option value="priceAsc">{isFr ? "Prix croissant" : "Price asc"}</option>
            <option value="priceDesc">{isFr ? "Prix decroissant" : "Price desc"}</option>
            <option value="newest">{isFr ? "Nouveaux" : "Newest"}</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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

        {activeChips.length > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300/60"
          >
            {isFr ? "Reset" : "Reset"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
