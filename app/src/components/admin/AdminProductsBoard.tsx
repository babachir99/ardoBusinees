"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney, getDiscountedPrice } from "@/lib/format";

type Product = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  discountPercent?: number | null;
  currency: string;
  type: string;
  isActive: boolean;
  boostStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | null;
  boostedUntil?: string | null;
  createdAt: string;
  seller?: { displayName?: string | null } | null;
  images: { url: string; alt?: string | null }[];
};

export default function AdminProductsBoard() {
  const t = useTranslations("AdminProducts");
  const locale = useLocale();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (query) params.set("q", query);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Product[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!successToast) return;
    const timeout = window.setTimeout(() => setSuccessToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

  const toggleActive = async (id: string, isActive: boolean) => {
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setActionId(null);
    }
  };

  const updateBoost = async (id: string, boostStatus: string) => {
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boostStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setActionId(null);
    }
  };

  const removeProduct = async (product: Product) => {
    const confirmed = window.confirm(
      t("actions.deleteConfirm", { title: product.title })
    );
    if (!confirmed) {
      return;
    }

    setActionId(product.id);
    setError(null);
    setSuccessToast(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.delete"));
      }
      await load();
      setSuccessToast(t("success.delete"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.delete"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      {successToast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-zinc-900/95 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.25)] backdrop-blur [animation:toastSlideIn_220ms_ease-out]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                d="M5 10.5L8.5 14L15 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {successToast}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("refresh")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-300 sm:grid-cols-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder={t("filters.query")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("filters.all")}</option>
          <option value="active">{t("filters.active")}</option>
          <option value="inactive">{t("filters.inactive")}</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          {t("filters.apply")}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-400">{t("loading")}</p>}

      {!loading && items.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">{t("empty")}</p>
      )}

      {items.length > 0 && (
        <div className="mt-6 grid gap-4">
          {items.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-20 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt ?? product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {product.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {product.seller?.displayName ?? t("labels.unknownSeller")}
                    </p>
                    {product.discountPercent ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-emerald-200">
                          {formatMoney(
                            getDiscountedPrice(
                              product.priceCents,
                              product.discountPercent
                            ),
                            product.currency,
                            locale
                          )}
                        </span>
                        <span className="text-[11px] text-zinc-500 line-through">
                          {formatMoney(product.priceCents, product.currency, locale)}
                        </span>
                        <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                          -{product.discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-200">
                        {formatMoney(product.priceCents, product.currency, locale)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p className="uppercase">{product.type}</p>
                  <p className="mt-1">
                    {new Date(product.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    product.isActive
                      ? "bg-emerald-400/15 text-emerald-200"
                      : "bg-rose-400/15 text-rose-200"
                  }`}
                >
                  {product.isActive ? t("labels.active") : t("labels.inactive")}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    product.boostStatus === "APPROVED"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : product.boostStatus === "PENDING"
                      ? "bg-amber-400/15 text-amber-200"
                      : product.boostStatus === "REJECTED"
                      ? "bg-rose-400/15 text-rose-200"
                      : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {t(
                    `labels.boost.${(
                      product.boostStatus ?? "NONE"
                    ).toLowerCase()}`
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActive(product.id, !product.isActive)}
                  disabled={actionId === product.id}
                  className="rounded-full border border-white/20 px-4 py-2 text-[11px] text-white transition hover:border-white/40 disabled:opacity-60"
                >
                  {product.isActive ? t("actions.disable") : t("actions.enable")}
                </button>
                {product.boostStatus === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateBoost(product.id, "APPROVED")}
                      disabled={actionId === product.id}
                      className="rounded-full border border-emerald-300/50 px-4 py-2 text-[11px] text-emerald-200 transition hover:border-emerald-300/80 disabled:opacity-60"
                    >
                      {t("actions.boostApprove")}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateBoost(product.id, "REJECTED")}
                      disabled={actionId === product.id}
                      className="rounded-full border border-rose-300/40 px-4 py-2 text-[11px] text-rose-200 transition hover:border-rose-300/70 disabled:opacity-60"
                    >
                      {t("actions.boostReject")}
                    </button>
                  </>
                )}
                {product.boostStatus === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => updateBoost(product.id, "NONE")}
                    disabled={actionId === product.id}
                    className="rounded-full border border-white/20 px-4 py-2 text-[11px] text-white transition hover:border-white/40 disabled:opacity-60"
                  >
                    {t("actions.boostClear")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeProduct(product)}
                  disabled={actionId === product.id}
                  className="rounded-full border border-rose-300/40 px-4 py-2 text-[11px] text-rose-200 transition hover:border-rose-300/70 disabled:opacity-60"
                >
                  {t("actions.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

