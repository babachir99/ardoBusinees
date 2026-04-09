"use client";

export const LEGACY_RECENT_SEARCHES_STORAGE_KEY = "jontaado_recent_searches";
export const LEGACY_RECENT_VIEWS_STORAGE_KEY = "jontaado_recent_views";

const RECENT_SEARCHES_STORAGE_PREFIX = "jontaado_recent_searches";
const RECENT_VIEWS_STORAGE_PREFIX = "jontaado_recent_views";

export const MAX_RECENT_SEARCHES = 6;
export const MAX_RECENT_VIEWS = 6;

export type RecentSearchItem = {
  query: string;
  category: string;
  sort: string;
  createdAt: number;
};

export type RecentViewItem = {
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

export function resolveRecentSignalsScope(storageScope?: string | null) {
  return storageScope?.trim() ? `user:${storageScope.trim()}` : "guest";
}

function buildScopedStorageKey(prefix: string, storageScope?: string | null) {
  return `${prefix}:${resolveRecentSignalsScope(storageScope)}`;
}

export function getRecentSearchesStorageKey(storageScope?: string | null) {
  return buildScopedStorageKey(RECENT_SEARCHES_STORAGE_PREFIX, storageScope);
}

export function getRecentViewsStorageKey(storageScope?: string | null) {
  return buildScopedStorageKey(RECENT_VIEWS_STORAGE_PREFIX, storageScope);
}

export function canonicalizeSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function areSearchVariants(a: string, b: string) {
  const left = canonicalizeSearchTerm(a);
  const right = canonicalizeSearchTerm(b);

  if (!left || !right) return false;
  if (left === right) return true;

  const shortest = Math.min(left.length, right.length);
  if (shortest < 3) return false;

  return left.startsWith(right) || right.startsWith(left);
}

export function getRecentSearchItemKey(item: RecentSearchItem) {
  return `${canonicalizeSearchTerm(item.query)}::${item.category}::${item.sort}::${item.createdAt}`;
}

function readStoredArray<T>(
  primaryKey: string,
  legacyKey: string,
  storageScope?: string | null
) {
  if (typeof window === "undefined") {
    return [] as T[];
  }

  try {
    const scopedRaw = window.localStorage.getItem(primaryKey);
    if (scopedRaw) {
      return JSON.parse(scopedRaw) as T[];
    }

    if (resolveRecentSignalsScope(storageScope) === "guest") {
      const legacyRaw = window.localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as T[];
        window.localStorage.setItem(primaryKey, JSON.stringify(parsed));
        window.localStorage.removeItem(legacyKey);
        return parsed;
      }
    }
  } catch {
    return [] as T[];
  }

  return [] as T[];
}

export function normalizeRecentSearches(items: RecentSearchItem[]) {
  return items.reduce<RecentSearchItem[]>((acc, item) => {
    const query = item.query.trim();
    const hasMeaningfulValue = Boolean(query || item.category || item.sort !== "recent");
    if (!hasMeaningfulValue) {
      return acc;
    }

    const existingIndex = acc.findIndex((existing) => {
      if (!query || !existing.query.trim()) {
        return existing.query.trim() === query;
      }

      return areSearchVariants(existing.query, query);
    });

    if (existingIndex === -1) {
      acc.push({ ...item, query });
      return acc;
    }

    const current = acc[existingIndex];
    const currentQuery = current.query.trim();
    const shouldReplace =
      query.length > currentQuery.length ||
      (query.length === currentQuery.length && item.createdAt >= current.createdAt);

    if (shouldReplace) {
      acc[existingIndex] = { ...item, query };
    }

    return acc;
  }, []);
}

export function readRecentSearches(storageScope?: string | null) {
  const items = readStoredArray<RecentSearchItem>(
    getRecentSearchesStorageKey(storageScope),
    LEGACY_RECENT_SEARCHES_STORAGE_KEY,
    storageScope
  );

  return normalizeRecentSearches(items)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_RECENT_SEARCHES);
}

export function persistRecentSearches(
  storageScope: string | null | undefined,
  items: RecentSearchItem[]
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getRecentSearchesStorageKey(storageScope),
      JSON.stringify(items)
    );
  } catch {
    // ignore storage issues
  }
}

function pickPreferredSearch(
  current: RecentSearchItem,
  incoming: Omit<RecentSearchItem, "createdAt"> & { createdAt?: number }
) {
  const currentQuery = current.query.trim();
  const incomingQuery = incoming.query.trim();

  if (incomingQuery.length > currentQuery.length) {
    return {
      query: incomingQuery,
      category: incoming.category,
      sort: incoming.sort,
      createdAt: incoming.createdAt ?? Date.now(),
    };
  }

  return current;
}

export function storeRecentSearch(
  storageScope: string | null | undefined,
  entry: Omit<RecentSearchItem, "createdAt">
) {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedQuery = entry.query.trim();
  const hasMeaningfulValue = Boolean(
    normalizedQuery || entry.category || entry.sort !== "recent"
  );
  if (!hasMeaningfulValue) {
    return [];
  }

  const current = readRecentSearches(storageScope);

  const duplicate = current.find((item) => {
    if (!normalizedQuery) {
      return item.query.trim() === "";
    }

    return areSearchVariants(item.query, normalizedQuery);
  });

  const deduped = current.filter((item) => {
    if (!normalizedQuery) {
      return item.query.trim() !== "";
    }

    return !areSearchVariants(item.query, normalizedQuery);
  });

  const next = normalizeRecentSearches([
    duplicate
      ? pickPreferredSearch(duplicate, {
          query: normalizedQuery,
          category: entry.category,
          sort: entry.sort,
          createdAt: Date.now(),
        })
      : {
          query: normalizedQuery,
          category: entry.category,
          sort: entry.sort,
          createdAt: Date.now(),
        },
    ...deduped,
  ]).slice(0, MAX_RECENT_SEARCHES);

  persistRecentSearches(storageScope, next);
  window.dispatchEvent(
    new CustomEvent("jontaado:recent-searches-updated", {
      detail: { scope: resolveRecentSignalsScope(storageScope), items: next },
    })
  );

  return next;
}

export function removeRecentSearch(
  storageScope: string | null | undefined,
  itemKey: string
) {
  if (typeof window === "undefined") {
    return [];
  }

  const next = readRecentSearches(storageScope).filter(
    (item) => getRecentSearchItemKey(item) !== itemKey
  );

  persistRecentSearches(storageScope, next);
  window.dispatchEvent(
    new CustomEvent("jontaado:recent-searches-updated", {
      detail: { scope: resolveRecentSignalsScope(storageScope), items: next },
    })
  );

  return next;
}

export function clearRecentSearches(storageScope: string | null | undefined) {
  if (typeof window === "undefined") {
    return [];
  }

  persistRecentSearches(storageScope, []);
  window.dispatchEvent(
    new CustomEvent("jontaado:recent-searches-updated", {
      detail: { scope: resolveRecentSignalsScope(storageScope), items: [] },
    })
  );

  return [];
}

export function readRecentViews(storageScope?: string | null) {
  const items = readStoredArray<RecentViewItem>(
    getRecentViewsStorageKey(storageScope),
    LEGACY_RECENT_VIEWS_STORAGE_KEY,
    storageScope
  );

  const deduped = items.reduce<RecentViewItem[]>((acc, item) => {
    if (acc.some((existing) => existing.id === item.id)) {
      return acc;
    }

    acc.push(item);
    return acc;
  }, []);

  return deduped
    .sort((left, right) => right.viewedAt - left.viewedAt)
    .slice(0, MAX_RECENT_VIEWS);
}

export function persistRecentViews(
  storageScope: string | null | undefined,
  items: RecentViewItem[]
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getRecentViewsStorageKey(storageScope),
      JSON.stringify(items)
    );
  } catch {
    // ignore storage issues
  }
}

export function storeRecentView(
  storageScope: string | null | undefined,
  item: Omit<RecentViewItem, "viewedAt">
) {
  if (typeof window === "undefined") {
    return [];
  }

  const next = [
    {
      ...item,
      viewedAt: Date.now(),
    },
    ...readRecentViews(storageScope).filter((existing) => existing.id !== item.id),
  ].slice(0, MAX_RECENT_VIEWS);

  persistRecentViews(storageScope, next);
  window.dispatchEvent(
    new CustomEvent("jontaado:recent-views-updated", {
      detail: { scope: resolveRecentSignalsScope(storageScope), items: next },
    })
  );

  return next;
}

export function clearRecentViews(storageScope: string | null | undefined) {
  if (typeof window === "undefined") {
    return [];
  }

  persistRecentViews(storageScope, []);
  window.dispatchEvent(
    new CustomEvent("jontaado:recent-views-updated", {
      detail: { scope: resolveRecentSignalsScope(storageScope), items: [] },
    })
  );

  return [];
}
