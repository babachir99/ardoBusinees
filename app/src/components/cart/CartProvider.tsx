"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

type CartScope =
  | { mode: "guest"; storageKey: string }
  | { mode: "user"; userId: string; storageKey: string };

const CartContext = createContext<CartContextValue | null>(null);
const BASE_STORAGE_KEY = "ardo_cart";
const GUEST_STORAGE_KEY = `${BASE_STORAGE_KEY}::guest`;

function toSafeMaxQuantity(value: unknown): number | undefined {
  const max = Number(value);
  if (!Number.isFinite(max) || max <= 0) return undefined;
  return Math.floor(max);
}

function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(Boolean)
    .map((item) => {
      const id = String((item as Record<string, unknown>).id ?? "").trim();
      if (!id) return null;

      const offerIdRaw = (item as Record<string, unknown>).offerId;
      const optionColorRaw = (item as Record<string, unknown>).optionColor;
      const optionSizeRaw = (item as Record<string, unknown>).optionSize;

      const offerId = offerIdRaw ? String(offerIdRaw) : undefined;
      const optionColor = optionColorRaw ? String(optionColorRaw) : undefined;
      const optionSize = optionSizeRaw ? String(optionSizeRaw) : undefined;

      const maxQuantity = toSafeMaxQuantity((item as Record<string, unknown>).maxQuantity);
      const quantityRaw = Number((item as Record<string, unknown>).quantity);
      let quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
      if (maxQuantity) quantity = Math.min(quantity, maxQuantity);

      const lineIdRaw = (item as Record<string, unknown>).lineId;

      return {
        id,
        slug: String((item as Record<string, unknown>).slug ?? ""),
        title: String((item as Record<string, unknown>).title ?? ""),
        priceCents: Number((item as Record<string, unknown>).priceCents ?? 0),
        currency: String((item as Record<string, unknown>).currency ?? "XOF"),
        type:
          (item as Record<string, unknown>).type === "PREORDER" ||
          (item as Record<string, unknown>).type === "DROPSHIP" ||
          (item as Record<string, unknown>).type === "LOCAL"
            ? ((item as Record<string, unknown>).type as "PREORDER" | "DROPSHIP" | "LOCAL")
            : "LOCAL",
        quantity,
        sellerName: (item as Record<string, unknown>).sellerName
          ? String((item as Record<string, unknown>).sellerName)
          : undefined,
        offerId,
        optionColor,
        optionSize,
        maxQuantity,
        lineId: lineIdRaw
          ? String(lineIdRaw)
          : makeLineId({ id, offerId, optionColor, optionSize }),
      } satisfies CartItem;
    })
    .filter(Boolean) as CartItem[];
}

function parseStored(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    return normalizeCartItems(JSON.parse(value));
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

    if (key === GUEST_STORAGE_KEY) {
      const legacyValue = window.localStorage.getItem(BASE_STORAGE_KEY);
      if (legacyValue) {
        window.localStorage.setItem(GUEST_STORAGE_KEY, legacyValue);
        window.localStorage.removeItem(BASE_STORAGE_KEY);
        return parseStored(legacyValue);
      }
    }
  } catch {
    return [];
  }

  return [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<CartScope>({
    mode: "guest",
    storageKey: GUEST_STORAGE_KEY,
  });
  const [items, setItems] = useState<CartItem[]>([]);

  const scopeRef = useRef<CartScope>(scope);
  const previousScopeRef = useRef<CartScope | null>(null);

  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  const fetchUserCart = useCallback(async () => {
    const response = await fetch("/api/cart", { cache: "no-store" });
    if (!response.ok) return null;

    const payload = (await response.json()) as { items?: unknown };
    return normalizeCartItems(payload.items);
  }, []);

  const mergeGuestCartIntoUser = useCallback(async () => {
    const guestItems = readCartForKey(GUEST_STORAGE_KEY);
    if (guestItems.length === 0) return;

    await fetch("/api/cart/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: guestItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          offerId: item.offerId,
          optionColor: item.optionColor,
          optionSize: item.optionSize,
        })),
      }),
    });

    try {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const resolveScope = useCallback(async () => {
    let nextScope: CartScope = {
      mode: "guest",
      storageKey: GUEST_STORAGE_KEY,
    };

    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { id?: string } | null;
        if (payload?.id) {
          nextScope = {
            mode: "user",
            userId: payload.id,
            storageKey: storageKeyForUserId(payload.id),
          };
        }
      }
    } catch {
      nextScope = {
        mode: "guest",
        storageKey: GUEST_STORAGE_KEY,
      };
    }

    setScope((current) => {
      if (
        current.mode === nextScope.mode &&
        current.storageKey === nextScope.storageKey &&
        (current.mode !== "user" || current.userId === (nextScope as { userId?: string }).userId)
      ) {
        return current;
      }
      return nextScope;
    });
  }, []);

  useEffect(() => {
    void resolveScope();

    const handleFocus = () => {
      void resolveScope();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void resolveScope();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [resolveScope]);

  useEffect(() => {
    let cancelled = false;
    const previousScope = previousScopeRef.current;
    previousScopeRef.current = scope;

    const hydrateCart = async () => {
      if (scope.mode === "guest") {
        if (!cancelled) {
          setItems(readCartForKey(scope.storageKey));
        }
        return;
      }

      if (previousScope?.mode === "guest") {
        await mergeGuestCartIntoUser();
      }

      const remoteItems = await fetchUserCart();
      if (cancelled) return;

      if (remoteItems) {
        setItems(remoteItems);
      } else {
        setItems(readCartForKey(scope.storageKey));
      }
    };

    void hydrateCart();

    return () => {
      cancelled = true;
    };
  }, [scope, fetchUserCart, mergeGuestCartIntoUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem(scope.storageKey, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [items, scope.storageKey]);

  const syncUserCartResponse = useCallback(
    async (response: Response) => {
      if (!response.ok) {
        if (response.status === 401) {
          await resolveScope();
        }
        return;
      }

      const payload = (await response.json()) as { items?: unknown };
      setItems(normalizeCartItems(payload.items));
    },
    [resolveScope]
  );

  const addItem = useCallback(
    (item: AddItemInput, quantity = 1) => {
      const requestedQty = Math.max(1, Math.floor(quantity));
      const incomingMax = toSafeMaxQuantity(item.maxQuantity);
      const lineId = makeLineId({
        id: item.id,
        offerId: item.offerId,
        optionColor: item.optionColor,
        optionSize: item.optionSize,
      });

      if (scopeRef.current.mode === "guest") {
        setItems((current) => {
          const existing = current.find((entry) => entry.lineId === lineId);
          const effectiveMax =
            existing?.maxQuantity && incomingMax
              ? Math.min(existing.maxQuantity, incomingMax)
              : existing?.maxQuantity ?? incomingMax;

          if (!existing) {
            const safeQty = effectiveMax
              ? Math.min(requestedQty, effectiveMax)
              : requestedQty;
            return [
              ...current,
              { ...item, quantity: safeQty, maxQuantity: effectiveMax, lineId },
            ];
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
        return;
      }

      void (async () => {
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: item.id,
            quantity: requestedQty,
            offerId: item.offerId,
            optionColor: item.optionColor,
            optionSize: item.optionSize,
          }),
        });

        await syncUserCartResponse(response);
      })();
    },
    [syncUserCartResponse]
  );

  const removeItem = useCallback(
    (lineId: string) => {
      if (scopeRef.current.mode === "guest") {
        setItems((current) => current.filter((entry) => entry.lineId !== lineId));
        return;
      }

      void (async () => {
        const response = await fetch(`/api/cart/${encodeURIComponent(lineId)}`, {
          method: "DELETE",
        });
        await syncUserCartResponse(response);
      })();
    },
    [syncUserCartResponse]
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (scopeRef.current.mode === "guest") {
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
        return;
      }

      void (async () => {
        const method = quantity <= 0 ? "DELETE" : "PATCH";
        const response = await fetch(`/api/cart/${encodeURIComponent(lineId)}`, {
          method,
          headers: method === "PATCH" ? { "Content-Type": "application/json" } : undefined,
          body: method === "PATCH" ? JSON.stringify({ quantity }) : undefined,
        });

        await syncUserCartResponse(response);
      })();
    },
    [syncUserCartResponse]
  );

  const clear = useCallback(() => {
    if (scopeRef.current.mode === "guest") {
      setItems([]);
      return;
    }

    void (async () => {
      const response = await fetch("/api/cart", { method: "DELETE" });
      await syncUserCartResponse(response);
    })();
  }, [syncUserCartResponse]);

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
