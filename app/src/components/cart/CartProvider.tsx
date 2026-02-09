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
  optionColor?: string;
  optionSize?: string;
  lineId: string;
};

function makeLineId(input: {
  id: string;
  optionColor?: string;
  optionSize?: string;
}) {
  return [input.id, input.optionColor ?? "", input.optionSize ?? ""].join("::");
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
const STORAGE_KEY = "ardo_cart";

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

        const quantityRaw = Number(item.quantity);
        const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
        const optionColor = item.optionColor ? String(item.optionColor) : undefined;
        const optionSize = item.optionSize ? String(item.optionSize) : undefined;

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
          optionColor,
          optionSize,
          quantity,
          lineId: item.lineId
            ? String(item.lineId)
            : makeLineId({ id, optionColor, optionSize }),
        } satisfies CartItem;
      })
      .filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = parseStored(localStorage.getItem(STORAGE_KEY));
      setItems(stored);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore write errors (storage disabled)
    }
  }, [items]);

  const addItem = useCallback((item: AddItemInput, quantity = 1) => {
    const safeQty = Math.max(1, Math.floor(quantity));
    const lineId = makeLineId({
      id: item.id,
      optionColor: item.optionColor,
      optionSize: item.optionSize,
    });

    setItems((current) => {
      const existing = current.find((entry) => entry.lineId === lineId);
      if (!existing) {
        return [...current, { ...item, quantity: safeQty, lineId }];
      }
      return current.map((entry) =>
        entry.lineId === lineId
          ? { ...entry, quantity: entry.quantity + safeQty }
          : entry
      );
    });
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((current) => current.filter((entry) => entry.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) {
        return current.filter((entry) => entry.lineId !== lineId);
      }
      return current.map((entry) =>
        entry.lineId === lineId ? { ...entry, quantity } : entry
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
