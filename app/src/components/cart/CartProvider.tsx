"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  type: "PREORDER" | "DROPSHIP" | "LOCAL";
  quantity: number;
  sellerName?: string;
  offerId?: string;
  optionColor?: string;
  optionSize?: string;
  maxQuantity?: number;
  lineId: string;
};

function makeLineId(input: {
  id: string;
  offerId?: string;
  optionColor?: string;
  optionSize?: string;
}) {
  return [
    input.id,
    input.offerId ?? "",
    input.optionColor ?? "",
    input.optionSize ?? "",
  ].join("::");
}

type AddItemInput = Omit<CartItem, "quantity" | "lineId">;

type CartContextValue = {
  items: CartItem[];
  addItem: (item: AddItemInput, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotalCents: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const BASE_STORAGE_KEY = "ardo_cart";
const GUEST_STORAGE_KEY = `${BASE_STORAGE_KEY}::guest`;

function toSafeMaxQuantity(value: unknown): number | undefined {
  const max = Number(value);
  if (!Number.isFinite(max) || max <= 0) return undefined;
  return Math.floor(max);
}

function parseStored(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(Boolean)
      .map((item) => {
        const id = String(item.id ?? "");
        if (!id) return null;

        const maxQuantity = toSafeMaxQuantity(item.maxQuantity);
        const quantityRaw = Number(item.quantity);
        let quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
        if (maxQuantity) quantity = Math.min(quantity, maxQuantity);

        const optionColor = item.optionColor ? String(item.optionColor) : undefined;
        const optionSize = item.optionSize ? String(item.optionSize) : undefined;
        const offerId = item.offerId ? String(item.offerId) : undefined;

        return {
          id,
          slug: String(item.slug ?? ""),
          title: String(item.title ?? ""),
          priceCents: Number(item.priceCents ?? 0),
          currency: String(item.currency ?? "XOF"),
          type:
            item.type === "PREORDER" || item.type === "DROPSHIP" || item.type === "LOCAL"
              ? item.type
              : "LOCAL",
          sellerName: item.sellerName ? String(item.sellerName) : undefined,
          offerId,
          optionColor,
          optionSize,
          maxQuantity,
          quantity,
          lineId: item.lineId
            ? String(item.lineId)
            : makeLineId({ id, offerId, optionColor, optionSize }),
        } satisfies CartItem;
      })
      .filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
}

function storageKeyForUserId(userId?: string) {
  if (!userId) return GUEST_STORAGE_KEY;
  return `${BASE_STORAGE_KEY}::user::${userId}`;
}

function readCartForKey(key: string): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const scopedValue = window.localStorage.getItem(key);
    if (scopedValue) {
      return parseStored(scopedValue);
    }

    // One-time migration from old global cart key to guest scope.
    if (key === GUEST_STORAGE_KEY) {
      const legacyValue = window.localStorage.getItem(BASE_STORAGE_KEY);
      if (legacyValue) {
        window.localStorage.setItem(GUEST_STORAGE_KEY, legacyValue);
        window.localStorage.removeItem(BASE_STORAGE_KEY);
        return parseStored(legacyValue);
      }
    }
  } catch {
    // Ignore read errors (storage disabled)
  }

  return [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [storageKey, setStorageKey] = useState<string>(GUEST_STORAGE_KEY);
  const [items, setItems] = useState<CartItem[]>([]);

  const resolveStorageScope = useCallback(async () => {
    let nextKey = GUEST_STORAGE_KEY;

    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.ok) {
        const profile = (await response.json()) as { id?: string } | null;
        nextKey = storageKeyForUserId(profile?.id);
      }
    } catch {
      nextKey = GUEST_STORAGE_KEY;
    }

    setStorageKey((current) => (current === nextKey ? current : nextKey));
  }, []);

  useEffect(() => {
    void resolveStorageScope();

    const handleFocus = () => {
      void resolveStorageScope();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void resolveStorageScope();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [resolveStorageScope]);

  useEffect(() => {
    setItems(readCartForKey(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore write errors (storage disabled)
    }
  }, [items, storageKey]);

  const addItem = useCallback((item: AddItemInput, quantity = 1) => {
    const requestedQty = Math.max(1, Math.floor(quantity));
    const incomingMax = toSafeMaxQuantity(item.maxQuantity);
    const lineId = makeLineId({
      id: item.id,
      offerId: item.offerId,
      optionColor: item.optionColor,
      optionSize: item.optionSize,
    });

    setItems((current) => {
      const existing = current.find((entry) => entry.lineId === lineId);
      const effectiveMax =
        existing?.maxQuantity && incomingMax
          ? Math.min(existing.maxQuantity, incomingMax)
          : existing?.maxQuantity ?? incomingMax;

      if (!existing) {
        const safeQty = effectiveMax ? Math.min(requestedQty, effectiveMax) : requestedQty;
        return [...current, { ...item, quantity: safeQty, maxQuantity: effectiveMax, lineId }];
      }

      const nextQty = effectiveMax
        ? Math.min(existing.quantity + requestedQty, effectiveMax)
        : existing.quantity + requestedQty;

      return current.map((entry) =>
        entry.lineId === lineId
          ? { ...entry, maxQuantity: effectiveMax, quantity: nextQty }
          : entry
      );
    });
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((current) => current.filter((entry) => entry.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((current) => {
      const entry = current.find((item) => item.lineId === lineId);
      if (!entry) return current;

      if (quantity <= 0) {
        return current.filter((item) => item.lineId !== lineId);
      }

      let nextQty = Math.max(1, Math.floor(quantity));
      if (entry.maxQuantity) {
        nextQty = Math.min(nextQty, entry.maxQuantity);
      }

      return current.map((item) =>
        item.lineId === lineId ? { ...item, quantity: nextQty } : item
      );
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0
    );

    return { items, addItem, removeItem, updateQuantity, clear, count, subtotalCents };
  }, [items, addItem, removeItem, updateQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
