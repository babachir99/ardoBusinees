"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useMemo, useState } from "react";

type SearchBarProps = {
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: string;
  categories: { name: string; slug: string }[];
  suggestions: string[];
};

export default function SearchBar({
  initialQuery,
  initialCategory,
  initialSort,
  categories,
  suggestions,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [sort, setSort] = useState(initialSort ?? "recent");

  const paramsString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (sort && sort !== "recent") params.set("sort", sort);
    return params.toString();
  }, [query, category, sort]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(`/?${paramsString}`);
  };

  useEffect(() => {
    router.push(`/?${paramsString}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full items-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-r from-zinc-950/70 via-zinc-950/60 to-zinc-950/70 px-2 py-1 text-xs text-zinc-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
    >
      <span className="text-zinc-500">🔎</span>
      <input
        list="search-suggestions"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Que cherchez-vous aujourd'hui ?"
        className="min-w-[140px] flex-1 bg-transparent text-xs text-zinc-100 outline-none"
      />
      <datalist id="search-suggestions">
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <div className="hidden items-center gap-2 lg:flex">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-full border border-white/10 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-200"
        >
          <option value="">Categories</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded-full border border-white/10 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-200"
        >
          <option value="recent">Recents</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix decroissant</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("");
            setSort("recent");
            router.push("/");
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-300/40 text-[10px] leading-none text-rose-300 transition hover:border-rose-300/70"
          aria-label="Effacer"
          title="Effacer"
        >
          🗑️
        </button>
      </div>
      <button
        type="submit"
        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-semibold leading-none text-zinc-950"
        aria-label="Rechercher"
      >
        🔍
      </button>
    </form>
  );
}
