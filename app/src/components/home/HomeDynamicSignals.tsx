"use client";

import { Link } from "@/i18n/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState } from "react";

const RECENT_SEARCHES_STORAGE_KEY = "jontaado_recent_searches";
const RECENT_VIEWS_STORAGE_KEY = "jontaado_recent_views";

type HomeLikedItem = {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  discountPercent?: number | null;
  sellerName?: string | null;
  likedAt?: string | null;
  favoritesCount?: number;
};

type RecentViewItem = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  discountPercent?: number | null;
  sellerName?: string | null;
  imageUrl?: string | null;
  viewedAt: number;
};

type HomeDynamicSignalsProps = {
  locale: string;
  isLoggedIn: boolean;
  initialLikedItems: HomeLikedItem[];
};

type FavoriteApiItem = {
  id: string;
  productId: string;
  createdAt?: string;
  product: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    discountPercent?: number | null;
    seller?: { displayName?: string | null } | null;
  };
};

type RecentSearchItem = {
  query: string;
  category: string;
  sort: string;
  createdAt: number;
};

function readRecentSearches() {
  if (typeof window === "undefined") {
    return [] as RecentSearchItem[];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentSearchItem[]) : [];
  } catch {
    return [];
  }
}

function readRecentViews() {
  if (typeof window === "undefined") {
    return [] as RecentViewItem[];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_VIEWS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentViewItem[]) : [];
  } catch {
    return [];
  }
}

function buildSearchHref(item: RecentSearchItem) {
  const params = new URLSearchParams();
  if (item.query) params.set("q", item.query);
  if (item.category) params.set("category", item.category);
  if (item.sort && item.sort !== "recent") params.set("sort", item.sort);
  const value = params.toString();
  return value ? `/shop?${value}` : "/shop";
}

function formatRecentSearchLabel(item: RecentSearchItem, isFr: boolean) {
  if (item.query && item.category) {
    return `${item.query} · ${item.category}`;
  }

  if (item.query) {
    return item.query;
  }

  if (item.category) {
    return isFr ? `Categorie ${item.category}` : `Category ${item.category}`;
  }

  return isFr ? "Recherche recente" : "Recent search";
}

export default function HomeDynamicSignals({
  locale,
  isLoggedIn,
  initialLikedItems,
}: HomeDynamicSignalsProps) {
  const isFr = locale === "fr";
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [recentViews, setRecentViews] = useState<RecentViewItem[]>([]);
  const [likedItems, setLikedItems] = useState<HomeLikedItem[]>(initialLikedItems);
  const [likesLoading, setLikesLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (!isLoggedIn) {
      return;
    }

    setLikesLoading(true);
    try {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as FavoriteApiItem[];
      const mapped = data.slice(0, 4).map((item) => ({
        productId: item.productId,
        slug: item.product.slug,
        title: item.product.title,
        priceCents: item.product.priceCents,
        currency: item.product.currency,
        discountPercent: item.product.discountPercent,
        sellerName: item.product.seller?.displayName ?? null,
        likedAt: item.createdAt ?? null,
      }));
      setLikedItems(mapped);
    } finally {
      setLikesLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    setLikedItems(initialLikedItems);
  }, [initialLikedItems]);

  useEffect(() => {
    const syncRecentSearches = () => setRecentSearches(readRecentSearches());
    const syncRecentViews = () => setRecentViews(readRecentViews());

    syncRecentSearches();
    syncRecentViews();

    const handleRecentSearchUpdate = () => syncRecentSearches();
    const handleRecentViewsUpdate = () => syncRecentViews();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === RECENT_SEARCHES_STORAGE_KEY) {
        syncRecentSearches();
      }
      if (event.key === RECENT_VIEWS_STORAGE_KEY) {
        syncRecentViews();
      }
    };

    window.addEventListener("jontaado:recent-searches-updated", handleRecentSearchUpdate);
    window.addEventListener("jontaado:recent-views-updated", handleRecentViewsUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("jontaado:recent-searches-updated", handleRecentSearchUpdate);
      window.removeEventListener("jontaado:recent-views-updated", handleRecentViewsUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const handleFavoriteUpdate = () => {
      void loadFavorites();
    };

    window.addEventListener("jontaado:favorites-updated", handleFavoriteUpdate);
    return () => {
      window.removeEventListener("jontaado:favorites-updated", handleFavoriteUpdate);
    };
  }, [isLoggedIn, loadFavorites]);

  const likedTitle = useMemo(() => {
    if (isLoggedIn) {
      return isFr ? "Derniers likes" : "Latest likes";
    }

    return isFr ? "Produits les plus likes" : "Most liked products";
  }, [isFr, isLoggedIn]);

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_16px_44px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/90">
              {isFr ? "Dernieres recherches" : "Recent searches"}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {isFr ? "Reprenez la ou vous vous etes arrete" : "Pick up where you left off"}
            </h3>
          </div>
          <Link
            href="/shop"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-emerald-300/30 hover:bg-white/10"
          >
            {isFr ? "Voir le shop" : "Open shop"}
          </Link>
        </div>

        {recentSearches.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {recentSearches.slice(0, 4).map((item) => (
              <Link
                key={`${item.query}-${item.category}-${item.sort}-${item.createdAt}`}
                href={buildSearchHref(item)}
                className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-3 transition hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-zinc-950/75"
              >
                <p className="truncate text-sm font-medium text-white">
                  {formatRecentSearchLabel(item, isFr)}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(item.createdAt).toLocaleString(locale, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/45 px-4 py-5 text-sm text-zinc-400">
            {isFr
              ? "Tes prochaines recherches apparaitront ici pour te permettre de reprendre plus vite."
              : "Your next searches will show up here so you can jump back in faster."}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_16px_44px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/90">
              {isFr ? "Dernieres vues" : "Recently viewed"}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {isFr ? "Produits consultes recemment" : "Products you viewed recently"}
            </h3>
          </div>
          <Link
            href="/shop"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            {isFr ? "Explorer" : "Explore"}
          </Link>
        </div>

        {recentViews.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {recentViews.slice(0, 4).map((item) => {
              const finalPrice = item.discountPercent
                ? getDiscountedPrice(item.priceCents, item.discountPercent)
                : item.priceCents;

              return (
                <Link
                  key={`${item.id}-${item.viewedAt}`}
                  href={`/shop/${item.slug}`}
                  className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-3 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-zinc-950/75"
                >
                  <p className="line-clamp-2 text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-200">
                    {formatMoney(finalPrice, item.currency, locale)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {item.sellerName || (isFr ? "Selection JONTAADO" : "JONTAADO pick")}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/45 px-4 py-5 text-sm text-zinc-400">
            {isFr
              ? "Les produits visites recemment apparaitront ici pour que tu puisses les retrouver rapidement."
              : "Recently viewed products will appear here so you can find them quickly."}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_16px_44px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/90">
              {isFr ? "Signal likes" : "Likes signal"}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">{likedTitle}</h3>
          </div>
          <Link
            href={isLoggedIn ? "/favorites" : "/shop"}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-amber-300/30 hover:bg-white/10"
          >
            {isLoggedIn ? (isFr ? "Mes favoris" : "My favorites") : isFr ? "Voir le shop" : "Open shop"}
          </Link>
        </div>

        {likesLoading ? (
          <div className="mt-4 grid gap-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-[92px] animate-pulse rounded-2xl border border-white/10 bg-zinc-950/50" />
            ))}
          </div>
        ) : likedItems.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {likedItems.slice(0, 4).map((item) => {
              const finalPrice = item.discountPercent
                ? getDiscountedPrice(item.priceCents, item.discountPercent)
                : item.priceCents;

              return (
                <Link
                  key={item.productId}
                  href={`/shop/${item.slug}`}
                  className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-3 transition hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-zinc-950/75"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-white">{item.title}</p>
                    <span className="shrink-0 text-sm text-rose-300">♥</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-200">
                    {formatMoney(finalPrice, item.currency, locale)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {item.sellerName
                      ? item.sellerName
                      : item.favoritesCount
                        ? `${item.favoritesCount} likes`
                        : isFr
                          ? "Selection JONTAADO"
                          : "JONTAADO pick"}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/45 px-4 py-5 text-sm text-zinc-400">
            {isFr
              ? "Aucun like pour le moment. Commence a sauvegarder des produits pour retrouver tes coups de coeur ici."
              : "No likes yet. Start saving products and you will find them here."}
          </div>
        )}
      </div>
    </section>
  );
}
