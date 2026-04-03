"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const RECENT_SEARCHES_STORAGE_KEY = "jontaado_recent_searches";
const MAX_RECENT_SEARCHES = 6;

type SearchBarProps = {
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: string;
  categories: { name: string; slug: string }[];
  suggestions: string[];
  locale?: string;
  compact?: boolean;
  className?: string;
  targetPath?: string;
  autoNavigateOnFilters?: boolean;
  clearNavigates?: boolean;
};

type StoredRecentSearch = {
  query: string;
  category: string;
  sort: string;
  createdAt: number;
};

function storeRecentSearch(entry: Omit<StoredRecentSearch, "createdAt">) {
  if (typeof window === "undefined") {
    return;
  }

  const hasMeaningfulValue = Boolean(entry.query.trim() || entry.category || entry.sort !== "recent");
  if (!hasMeaningfulValue) {
    return;
  }

  let current: StoredRecentSearch[] = [];

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    current = raw ? (JSON.parse(raw) as StoredRecentSearch[]) : [];
  } catch {
    current = [];
  }

  const deduped = current.filter(
    (item) =>
      !(
        item.query === entry.query.trim() &&
        item.category === entry.category &&
        item.sort === entry.sort
      )
  );

  const next = [
    {
      query: entry.query.trim(),
      category: entry.category,
      sort: entry.sort,
      createdAt: Date.now(),
    },
    ...deduped,
  ].slice(0, MAX_RECENT_SEARCHES);

  window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("jontaado:recent-searches-updated", { detail: next }));
}

export default function SearchBar({
  initialQuery,
  initialCategory,
  initialSort,
  categories,
  suggestions,
  locale = "fr",
  compact = false,
  className,
  targetPath = "/",
  autoNavigateOnFilters = true,
  clearNavigates = true,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [sort, setSort] = useState(initialSort ?? "recent");
  const didMountRef = useRef(false);
  const isFr = locale === "fr";

  const paramsString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (sort && sort !== "recent") params.set("sort", sort);
    return params.toString();
  }, [query, category, sort]);

  const searchHref = paramsString ? `${targetPath}?${paramsString}` : targetPath;

  const navigateToSearch = () => {
    storeRecentSearch({ query, category, sort });
    router.push(searchHref);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    navigateToSearch();
  };

  useEffect(() => {
    if (!autoNavigateOnFilters) {
      return;
    }

    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    navigateToSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNavigateOnFilters, category, searchHref, sort]);

  const wrapperClass = compact
    ? "flex h-10 w-full items-center gap-2 rounded-full border border-white/10 bg-zinc-900/55 px-3 py-1 text-sm text-zinc-300 backdrop-blur-md transition-all duration-200 hover:border-white/15 focus-within:border-emerald-300/25 focus-within:bg-zinc-900/70"
    : "flex w-full items-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-r from-zinc-950/70 via-zinc-950/60 to-zinc-950/70 px-2 py-1 text-xs text-zinc-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)]";
  const selectClass = compact
    ? "h-8 rounded-full border border-white/10 bg-zinc-950/70 px-3 text-xs text-zinc-200 outline-none transition-all duration-200 hover:border-white/20 focus:border-emerald-300/25"
    : "w-[112px] rounded-full border border-white/10 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-200";
  const sortClass = compact
    ? "h-8 rounded-full border border-white/10 bg-zinc-950/70 px-3 text-xs text-zinc-200 outline-none transition-all duration-200 hover:border-white/20 focus:border-emerald-300/25"
    : "w-[96px] rounded-full border border-white/10 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-200";
  const clearButtonClass = compact
    ? "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-all duration-200 hover:border-rose-300/45 hover:text-rose-300"
    : "flex h-7 w-7 items-center justify-center rounded-full border border-rose-300/40 text-[10px] leading-none text-rose-300 transition hover:border-rose-300/70";
  const submitButtonClass = compact
    ? "ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-zinc-950 transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-300"
    : "ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-semibold leading-none text-zinc-950";

  return (
    <form
      onSubmit={onSubmit}
      className={className ? `${wrapperClass} ${className}` : wrapperClass}
    >
      <span className="text-zinc-500" aria-hidden="true">
        <svg viewBox="0 0 20 20" className={`${compact ? "h-4 w-4" : "h-4 w-4"} fill-none stroke-current stroke-[1.8]`}>
          <circle cx="8.5" cy="8.5" r="4.5" />
          <path d="m12 12 4 4" strokeLinecap="round" />
        </svg>
      </span>
      <input
        list="search-suggestions"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={isFr ? "Que cherchez-vous aujourd'hui ?" : "What are you looking for today?"}
        className={`min-w-0 flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-500 ${compact ? "text-sm" : "text-xs"}`}
      />
      <datalist id="search-suggestions">
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <div className="hidden items-center gap-2 xl:flex">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`${selectClass} ${compact ? "w-[124px]" : ""}`}
        >
          <option value="">{isFr ? "Categories" : "Categories"}</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className={`${sortClass} ${compact ? "w-[110px]" : ""}`}
        >
          <option value="recent">{isFr ? "Recents" : "Recent"}</option>
          <option value="price_asc">{isFr ? "Prix croissant" : "Price low-high"}</option>
          <option value="price_desc">{isFr ? "Prix decroissant" : "Price high-low"}</option>
          <option value="top_rated">{isFr ? "Mieux notes" : "Top rated"}</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("");
            setSort("recent");
            if (clearNavigates) {
              router.push(targetPath);
            }
          }}
          className={clearButtonClass}
          aria-label={isFr ? "Effacer" : "Clear"}
          title={isFr ? "Effacer" : "Clear"}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
            <path d="M5 6h10" strokeLinecap="round" />
            <path d="M7.5 6V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V6" strokeLinecap="round" />
            <path d="M7 8.5v5M10 8.5v5M13 8.5v5" strokeLinecap="round" />
            <path d="M6.5 6h7l-.4 8.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9L6.5 6Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <button
        type="submit"
        className={submitButtonClass}
        aria-label={isFr ? "Rechercher" : "Search"}
      >
        <svg viewBox="0 0 20 20" className={`${compact ? "h-4 w-4" : "h-4 w-4"} fill-none stroke-current stroke-[1.8]`}>
          <circle cx="8.5" cy="8.5" r="4.5" />
          <path d="m12 12 4 4" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
