"use client";

/* eslint-disable @next/next/no-img-element */

import { useSessionUserId } from "@/components/auth/SessionScopeProvider";
import { useCart } from "@/components/cart/CartProvider";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { Link } from "@/i18n/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import {
  clearRecentSearches,
  clearRecentViews,
  persistRecentSearches,
  readRecentSearches,
  readRecentViews,
  type RecentSearchItem,
  type RecentViewItem,
} from "@/lib/recentSignals";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type HomeLikedItem = {
  productId: string;
  slug: string;
  title: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  priceCents: number;
  currency: string;
  discountPercent?: number | null;
  sellerName?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  likedAt?: string | null;
  favoritesCount?: number;
};

type HomeDynamicSignalsProps = {
  locale: string;
  isLoggedIn: boolean;
  initialLikedItems: HomeLikedItem[];
  storageScope?: string | null;
};

type FavoriteApiItem = {
  id: string;
  productId: string;
  createdAt?: string;
  product: {
    id: string;
    slug: string;
    title: string;
    type: "PREORDER" | "DROPSHIP" | "LOCAL";
    priceCents: number;
    currency: string;
    discountPercent?: number | null;
    seller?: { displayName?: string | null } | null;
    images?: Array<{ url?: string | null; alt?: string | null }>;
  };
};

type EmptyStateProps = {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  toneClassName?: string;
  children: ReactNode;
};

type SignalToastKind = "cart_added" | "cart_sold_out";

function buildSearchHref(item: RecentSearchItem) {
  const params = new URLSearchParams();
  if (item.query) params.set("q", item.query);
  if (item.category) params.set("category", item.category);
  if (item.sort && item.sort !== "recent") params.set("sort", item.sort);
  const value = params.toString();
  return value ? `/shop?${value}` : "/shop";
}

function formatRecentSearchLabel(item: RecentSearchItem, isFr: boolean) {
  const prettyQuery = item.query
    ? `${item.query.charAt(0).toUpperCase()}${item.query.slice(1)}`
    : "";

  if (item.query && item.category) {
    return `${prettyQuery} - ${item.category}`;
  }

  if (item.query) {
    return prettyQuery;
  }

  if (item.category) {
    return isFr ? `Categorie ${item.category}` : `Category ${item.category}`;
  }

  return isFr ? "Recherche recente" : "Recent search";
}

function formatCompactSignalDate(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M14.5 14.5L18 18M8.75 15.5a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M1.75 10S4.75 4.75 10 4.75 18.25 10 18.25 10 15.25 15.25 10 15.25 1.75 10 1.75 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 16.25s-5.75-3.52-5.75-8.04A3.46 3.46 0 0 1 7.71 4.75c1.04 0 1.9.49 2.29 1.2.39-.71 1.25-1.2 2.29-1.2a3.46 3.46 0 0 1 3.46 3.46c0 4.52-5.75 8.04-5.75 8.04Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M2.25 3.75h1.42c.43 0 .81.29.92.71l.28 1.04m0 0 1.1 4.2a1 1 0 0 0 .97.75h6.35a1 1 0 0 0 .96-.72l1.27-4.23H4.87ZM7.75 15.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M11.75 4.5 6.25 10l5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M8.25 4.5 13.75 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompassGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m12.9 7.1-1.45 4.35-4.35 1.45 1.45-4.35L12.9 7.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StoreGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3 8.25 4.1 4.75h11.8L17 8.25M3.75 7.75v7.5h12.5v-7.5M7 10.75h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5.25 6h9.5M7.5 6V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V6M7.75 8.5v5M10 8.5v5M12.25 8.5v5M6.5 6h7l-.38 8.06A1 1 0 0 1 12.12 15H7.88a1 1 0 0 1-.99-.94L6.5 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkHeartGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 16.25s-5.75-3.52-5.75-8.04A3.46 3.46 0 0 1 7.71 4.75c1.04 0 1.9.49 2.29 1.2.39-.71 1.25-1.2 2.29-1.2a3.46 3.46 0 0 1 3.46 3.46c0 4.52-5.75 8.04-5.75 8.04Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.75 2.5v2.5M17 3.75h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({
  ctaHref,
  ctaLabel,
  description,
  toneClassName = "",
  children,
}: EmptyStateProps) {
  return (
    <div className={`mt-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 ${toneClassName}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-zinc-400">
          {children}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-200">{description}</p>
          <Link
            href={ctaHref}
            className="mt-1.5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-zinc-300 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

function IconActionLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
    >
      {children}
    </Link>
  );
}

function AddToCartIconButton({
  item,
  locale,
  onAdded,
  onSoldOut,
}: {
  item: HomeLikedItem;
  locale: string;
  onAdded: () => void;
  onSoldOut: () => void;
}) {
  const { addItem } = useCart();
  const isFr = locale === "fr";
  const [added, setAdded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);

  const resolveLiveLocalStock = async (): Promise<number | undefined> => {
    try {
      const response = await fetch(`/api/products/${item.productId}`, { cache: "no-store" });
      if (!response.ok) return undefined;

      const payload = (await response.json()) as {
        isActive?: boolean;
        stockQuantity?: number | null;
      };

      if (payload?.isActive === false) return 0;

      const stockRaw = Number(payload?.stockQuantity);
      if (!Number.isFinite(stockRaw)) return undefined;
      return Math.max(0, Math.floor(stockRaw));
    } catch {
      return undefined;
    }
  };

  const handleAdd = async () => {
    if (isChecking || isSoldOut) {
      return;
    }

    if (item.type === "LOCAL") {
      setIsChecking(true);
      const liveStock = await resolveLiveLocalStock();
      setIsChecking(false);

      if (liveStock !== undefined && liveStock <= 0) {
        setIsSoldOut(true);
        onSoldOut();
        return;
      }
    }

    const result = await addItem(
      {
        id: item.productId,
        slug: item.slug,
        title: item.title,
        priceCents: item.priceCents,
        currency: item.currency,
        type: item.type,
        sellerName: item.sellerName ?? undefined,
      },
      1
    );

    if (!result.ok) {
      if (result.reason === "out_of_stock") {
        setIsSoldOut(true);
        onSoldOut();
      }
      return;
    }

    onAdded();
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleAdd();
      }}
      aria-label={isFr ? "Ajouter au panier" : "Add to cart"}
      title={isFr ? "Ajouter au panier" : "Add to cart"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition duration-200 active:scale-95 ${
        isSoldOut
          ? "border-amber-300/35 bg-amber-400/15 text-amber-100 opacity-100"
          : added
          ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
          : isChecking
            ? "border-white/15 bg-white/[0.08] text-white"
          : "border-white/10 bg-black/55 text-zinc-200 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-emerald-400/15 hover:text-white"
      }`}
    >
      <CartGlyph />
    </button>
  );
}

export default function HomeDynamicSignals({
  locale,
  isLoggedIn,
  initialLikedItems,
  storageScope,
}: HomeDynamicSignalsProps) {
  const isFr = locale === "fr";
  const sessionUserId = useSessionUserId();
  const effectiveStorageScope = storageScope ?? sessionUserId ?? null;
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [recentViews, setRecentViews] = useState<RecentViewItem[]>([]);
  const [likedItems, setLikedItems] = useState<HomeLikedItem[]>(initialLikedItems);
  const [likesLoading, setLikesLoading] = useState(false);
  const [toastKind, setToastKind] = useState<SignalToastKind | null>(null);
  const [recentSearchesCleared, setRecentSearchesCleared] = useState(false);
  const [recentViewsCleared, setRecentViewsCleared] = useState(false);
  const [activeTrashPulse, setActiveTrashPulse] = useState<"searches" | "views" | null>(null);
  const favoritesRailRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
        type: item.product.type,
        priceCents: item.product.priceCents,
        currency: item.product.currency,
        discountPercent: item.product.discountPercent,
        sellerName: item.product.seller?.displayName ?? null,
        imageUrl: item.product.images?.[0]?.url ?? null,
        imageAlt: item.product.images?.[0]?.alt ?? null,
        likedAt: item.createdAt ?? null,
      }));
      setLikedItems(mapped);
    } finally {
      setLikesLoading(false);
    }
  }, [isLoggedIn]);

  const syncRailState = useCallback(() => {
    const node = favoritesRailRef.current;
    if (!node) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(node.scrollLeft > 12);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 12);
  }, []);

  useEffect(() => {
    setLikedItems(initialLikedItems);
  }, [initialLikedItems]);

  useEffect(() => {
    syncRailState();
  }, [likedItems, syncRailState]);

  useEffect(() => {
    const onResize = () => syncRailState();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncRailState]);

  useEffect(() => {
    const syncRecentSearches = () => {
      const next = readRecentSearches(effectiveStorageScope);
      setRecentSearches(next);
      persistRecentSearches(effectiveStorageScope, next);
    };
    const syncRecentViews = () => setRecentViews(readRecentViews(effectiveStorageScope));

    syncRecentSearches();
    syncRecentViews();

    const handleRecentSearchUpdate = () => syncRecentSearches();
    const handleRecentViewsUpdate = () => syncRecentViews();
    const handleStorage = () => {
      if (typeof window === "undefined") {
        return;
      }
      if (
        document.visibilityState !== "hidden"
      ) {
        syncRecentSearches();
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
  }, [effectiveStorageScope]);

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

  useEffect(() => {
    if (!toastKind) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastKind(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [toastKind]);

  useEffect(() => {
    if (!recentSearchesCleared) {
      return;
    }

    const timeoutId = window.setTimeout(() => setRecentSearchesCleared(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [recentSearchesCleared]);

  useEffect(() => {
    if (!recentViewsCleared) {
      return;
    }

    const timeoutId = window.setTimeout(() => setRecentViewsCleared(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [recentViewsCleared]);

  useEffect(() => {
    if (!activeTrashPulse) {
      return;
    }

    const timeoutId = window.setTimeout(() => setActiveTrashPulse(null), 380);
    return () => window.clearTimeout(timeoutId);
  }, [activeTrashPulse]);

  const likedTitle = useMemo(() => {
    if (isLoggedIn) {
      return isFr ? "Vos coups de coeur" : "Your favorites";
    }

    return isFr ? "Vos coups de coeur" : "Top favorites";
  }, [isFr, isLoggedIn]);

  const primaryCardClass =
    "min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(26,32,36,0.95)_0%,rgba(14,17,20,0.92)_100%)] px-4 py-4 shadow-[0_18px_42px_rgba(0,0,0,0.2)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.24)]";
  const secondaryCardClass =
    "min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,27,31,0.94)_0%,rgba(14,16,19,0.9)_100%)] px-4 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.22)]";
  const secondaryRowClass =
    "group relative rounded-2xl border border-white/10 bg-black/20 px-3 py-2 transition duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]";
  const compactListClass =
    "max-h-[8.1rem] space-y-2 overflow-y-auto pr-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

  const scrollFavorites = (direction: "left" | "right") => {
    const node = favoritesRailRef.current;
    if (!node) return;

    node.scrollBy({
      left: direction === "right" ? 236 : -236,
      behavior: "smooth",
    });
  };

  const toastCopy = useMemo(
    () =>
      toastKind === "cart_sold_out"
        ? {
            title: isFr ? "Produit epuise" : "Product sold out",
            description: isFr
              ? "Ce produit n'est plus disponible pour le moment."
              : "This product is no longer available right now.",
          }
        : {
            title: isFr ? "Ajoute au panier" : "Added to cart",
            description: isFr
              ? "Tu peux finaliser ta selection quand tu veux."
              : "You can finish checkout whenever you are ready.",
          },
    [isFr, toastKind]
  );

  return (
    <>
      <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className={`${primaryCardClass} flex min-w-0 flex-col xl:h-[320px]`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">{likedTitle}</h3>
              <p className="mt-0.5 max-w-lg text-sm text-zinc-400">
                {isFr
                  ? "Retrouve tes produits sauvegardes et ajoute-les au panier en un geste."
                  : "Keep saved products close and add them to cart in one move."}
              </p>
              <p
                className={`mt-1.5 text-[11px] transition duration-200 ${
                  toastKind === "cart_sold_out" ? "text-amber-200" : "text-emerald-200"
                } ${
                  toastKind ? "opacity-100" : "opacity-0"
                }`}
                aria-live="polite"
              >
                {toastCopy.title}. {toastCopy.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden xl:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollFavorites("left")}
                  disabled={!canScrollLeft}
                  aria-label={isFr ? "Defiler vers la gauche" : "Scroll left"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeftGlyph />
                </button>
                <button
                  type="button"
                  onClick={() => scrollFavorites("right")}
                  disabled={!canScrollRight}
                  aria-label={isFr ? "Defiler vers la droite" : "Scroll right"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowRightGlyph />
                </button>
              </div>
              <IconActionLink
                href={isLoggedIn ? "/favorites" : "/shop"}
                label={
                  isLoggedIn
                    ? isFr
                      ? "Voir mes favoris"
                      : "View my favorites"
                    : isFr
                      ? "Explorer"
                      : "Explore"
                }
              >
                {isLoggedIn ? <HeartGlyph /> : <CompassGlyph />}
              </IconActionLink>
            </div>
          </div>

          {likesLoading ? (
            <div className="mt-4 flex flex-1 gap-3 overflow-hidden">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-[178px] min-w-[172px] animate-pulse rounded-2xl border border-white/10 bg-black/20 sm:min-w-[184px]"
                />
              ))}
            </div>
          ) : likedItems.length > 0 ? (
            <div
              ref={favoritesRailRef}
              onScroll={syncRailState}
              className="mt-3 flex min-w-0 flex-1 gap-2.5 overflow-x-auto pb-1 pr-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {likedItems.slice(0, 4).map((item) => {
                const finalPrice = item.discountPercent
                  ? getDiscountedPrice(item.priceCents, item.discountPercent)
                  : item.priceCents;

                return (
                  <Link
                    key={item.productId}
                    href={`/shop/${item.slug}`}
                    className="group relative min-w-[174px] snap-start rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,20,24,0.98)_0%,rgba(13,15,18,0.96)_100%)] p-2.5 transition duration-200 hover:-translate-y-1 hover:border-amber-300/20 hover:shadow-[0_14px_34px_rgba(0,0,0,0.22)] sm:min-w-[188px]"
                  >
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/25">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.imageAlt ?? item.title}
                          className="h-16 w-full object-cover transition duration-200 group-hover:scale-[1.02] sm:h-20"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-16 w-full items-center justify-center bg-white/[0.03] text-xs text-zinc-500 sm:h-20">
                          {isFr ? "Image a venir" : "Image coming soon"}
                        </div>
                      )}

                      <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                        {isLoggedIn ? (
                          <FavoriteButton
                            productId={item.productId}
                            initialIsFavorite={true}
                            variant="icon"
                            className="h-9 w-9 border-white/10 bg-black/55 text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] hover:border-rose-300/30 hover:bg-rose-400/15"
                          />
                        ) : (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/55 text-rose-300 shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
                            <SparkHeartGlyph />
                          </span>
                        )}
                        <AddToCartIconButton
                          item={item}
                          locale={locale}
                          onAdded={() => setToastKind("cart_added")}
                          onSoldOut={() => setToastKind("cart_sold_out")}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-emerald-200">
                          {formatMoney(finalPrice, item.currency, locale)}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                          {isFr ? "Favori" : "Saved"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {item.sellerName
                          ? item.sellerName
                          : item.favoritesCount
                            ? `${item.favoritesCount} likes`
                            : isFr
                              ? "Selection JONTAADO"
                              : "JONTAADO pick"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              ctaHref="/shop"
              ctaLabel={isFr ? "Explorer le shop" : "Explore shop"}
              description={
                isFr
                  ? "Aucun favori recent. Sauvegarde quelques produits pour les retrouver ici."
                  : "No recent favorites yet. Save products to keep them here."
              }
              toneClassName="mt-4"
            >
              <HeartGlyph />
            </EmptyState>
          )}
        </div>

        <div className="flex h-full min-w-0 min-h-0 flex-col gap-4 xl:h-[320px]">
          <div className={`${secondaryCardClass} flex min-h-0 flex-1 flex-col`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-white">
                  {isFr ? "Recherches recentes" : "Recent searches"}
                </h3>
                <p
                  className={`mt-1 text-[11px] text-emerald-200 transition duration-200 ${
                    recentSearchesCleared ? "opacity-100" : "opacity-0"
                  }`}
                  aria-live="polite"
                >
                  {isFr ? "Historique efface." : "History cleared."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {recentSearches.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecentSearches(clearRecentSearches(effectiveStorageScope));
                      setRecentSearchesCleared(true);
                      setActiveTrashPulse("searches");
                    }}
                    aria-label={isFr ? "Vider les recherches recentes" : "Clear recent searches"}
                    title={isFr ? "Vider l'historique" : "Clear history"}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white ${
                      activeTrashPulse === "searches"
                        ? "scale-[0.94] border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
                        : "border-white/10 text-zinc-300"
                    }`}
                  >
                    <TrashGlyph />
                  </button>
                ) : null}
                <IconActionLink href="/shop" label={isFr ? "Explorer" : "Explore"}>
                  <CompassGlyph />
                </IconActionLink>
              </div>
            </div>

            {recentSearches.length > 0 ? (
              <div className="relative mt-3 flex-1 min-h-0 overflow-hidden">
                <div className="pointer-events-none absolute bottom-3 left-[13px] top-3 w-px rounded-full bg-gradient-to-b from-emerald-300/0 via-emerald-300/20 to-emerald-300/0" />
                <div className={`${compactListClass} h-full`}>
                  {recentSearches.map((item) => (
                    <Link
                      key={`${item.query}-${item.category}-${item.sort}-${item.createdAt}`}
                      href={buildSearchHref(item)}
                      className={`${secondaryRowClass} min-h-[58px] overflow-hidden`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-400/10 text-emerald-200 shadow-[0_0_0_4px_rgba(15,16,19,0.9)]">
                          <SearchGlyph />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-tight text-white">
                            {formatRecentSearchLabel(item, isFr)}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-none text-zinc-400">
                            {formatCompactSignalDate(item.createdAt, locale)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {recentSearches.length > 2 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl bg-gradient-to-t from-[rgba(15,16,19,0.96)] to-transparent" />
                ) : null}
              </div>
            ) : (
              <EmptyState
                ctaHref="/shop"
                ctaLabel={isFr ? "Explorer les categories" : "Browse categories"}
                description={isFr ? "Aucune recherche recente." : "No recent searches."}
                toneClassName="mt-4"
              >
                <SearchGlyph />
              </EmptyState>
            )}
          </div>

          <div className={`${secondaryCardClass} flex min-h-0 flex-1 flex-col`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-white">
                  {isFr ? "Vu recemment" : "Viewed recently"}
                </h3>
                <p
                  className={`mt-1 text-[11px] text-cyan-200 transition duration-200 ${
                    recentViewsCleared ? "opacity-100" : "opacity-0"
                  }`}
                  aria-live="polite"
                >
                  {isFr ? "Historique efface." : "History cleared."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {recentViews.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecentViews(clearRecentViews(effectiveStorageScope));
                      setRecentViewsCleared(true);
                      setActiveTrashPulse("views");
                    }}
                    aria-label={isFr ? "Vider les vues recentes" : "Clear recent views"}
                    title={isFr ? "Vider l'historique" : "Clear history"}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white ${
                      activeTrashPulse === "views"
                        ? "scale-[0.94] border-cyan-300/35 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 text-zinc-300"
                    }`}
                  >
                    <TrashGlyph />
                  </button>
                ) : null}
                <IconActionLink href="/shop" label={isFr ? "Voir le shop" : "Open shop"}>
                  <StoreGlyph />
                </IconActionLink>
              </div>
            </div>

            {recentViews.length > 0 ? (
              <div className="relative mt-3 flex-1 min-h-0 overflow-hidden">
                <div className="pointer-events-none absolute bottom-3 left-[19px] top-3 w-px rounded-full bg-gradient-to-b from-cyan-300/0 via-cyan-300/20 to-cyan-300/0" />
                <div className={`${compactListClass} h-full`}>
                  {recentViews.map((item) => {
                    const finalPrice = item.discountPercent
                      ? getDiscountedPrice(item.priceCents, item.discountPercent)
                      : item.priceCents;

                    return (
                      <Link
                        key={`${item.id}-${item.viewedAt}`}
                        href={`/shop/${item.slug}`}
                        className={`${secondaryRowClass} min-h-[58px] overflow-hidden`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="relative z-[1] h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover shadow-[0_0_0_4px_rgba(15,16,19,0.9)]"
                              loading="lazy"
                            />
                          ) : (
                            <span className="relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200 shadow-[0_0_0_4px_rgba(15,16,19,0.9)]">
                              <EyeGlyph />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium leading-tight text-white">{item.title}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <span className="text-sm font-semibold text-emerald-200">
                                {formatMoney(finalPrice, item.currency, locale)}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                {item.sellerName || (isFr ? "Selection JONTAADO" : "JONTAADO pick")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {recentViews.length > 2 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl bg-gradient-to-t from-[rgba(15,16,19,0.96)] to-transparent" />
                ) : null}
              </div>
            ) : (
              <EmptyState
                ctaHref="/shop"
                ctaLabel={isFr ? "Decouvrir des produits" : "Discover products"}
                description={isFr ? "Aucune vue recente." : "No recent views."}
                toneClassName="mt-4"
              >
                <EyeGlyph />
              </EmptyState>
            )}
          </div>
        </div>
      </section>

    </>
  );
}
