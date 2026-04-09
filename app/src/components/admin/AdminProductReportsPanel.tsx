"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { PRODUCT_REPORT_AUTO_HIDE_THRESHOLD } from "@/lib/productReports.shared";

type ProductReportStatus = "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

type ProductReportItem = {
  id: string;
  productId: string;
  createdAt: string;
  reporter: {
    id: string;
    name: string | null;
    email: string | null;
  };
  product: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    sellerName: string | null;
    isActive: boolean;
    activeReportCount: number;
    autoHiddenByReports: boolean;
    autoHiddenAt: string | null;
  } | null;
  reason: string;
  description: string | null;
  status: ProductReportStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
};

const STATUS_LABELS: Record<
  ProductReportStatus,
  { fr: string; en: string; className: string }
> = {
  PENDING: {
    fr: "En attente",
    en: "Pending",
    className: "bg-amber-400/15 text-amber-200",
  },
  UNDER_REVIEW: {
    fr: "En revue",
    en: "Under review",
    className: "bg-sky-400/15 text-sky-200",
  },
  RESOLVED: {
    fr: "Traite",
    en: "Resolved",
    className: "bg-emerald-400/15 text-emerald-200",
  },
  DISMISSED: {
    fr: "Classe",
    en: "Dismissed",
    className: "bg-zinc-400/15 text-zinc-300",
  },
};

const REASON_LABELS: Record<string, { fr: string; en: string }> = {
  SCAM: { fr: "Arnaque", en: "Scam" },
  MISLEADING: { fr: "Trompeuse", en: "Misleading" },
  PROHIBITED: { fr: "Interdite", en: "Prohibited" },
  DUPLICATE: { fr: "Doublon", en: "Duplicate" },
  ABUSE: { fr: "Abusive", en: "Abusive" },
  OTHER: { fr: "Autre", en: "Other" },
};

export default function AdminProductReportsPanel({ locale }: { locale: string }) {
  const isFr = locale === "fr";
  const [items, setItems] = useState<ProductReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/product-reports", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          isFr ? "Impossible de charger les signalements." : "Unable to load reports."
        );
      }

      const data = (await response.json()) as ProductReportItem[];
      setItems(data);
      setNoteDrafts(
        data.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = item.adminNote ?? "";
          return acc;
        }, {})
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isFr
            ? "Impossible de charger les signalements."
            : "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  }, [isFr]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchItem = async (item: ProductReportItem, status: ProductReportStatus) => {
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/product-reports/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: noteDrafts[item.id] ?? "",
        }),
      });

      if (!response.ok) {
        throw new Error(
          isFr ? "Impossible de mettre a jour le signalement." : "Unable to update report."
        );
      }

      await load();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isFr
            ? "Impossible de mettre a jour le signalement."
            : "Unable to update report."
      );
    } finally {
      setBusyId(null);
    }
  };

  const reactivateListing = async (item: ProductReportItem) => {
    if (!item.product) return;
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${item.product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; activeReportCount?: number; threshold?: number }
          | null;
        if (payload?.error === "ACTIVE_REPORT_THRESHOLD_REACHED") {
          throw new Error(
            isFr
              ? `Reactiver impossible tant qu'il reste ${payload.activeReportCount ?? PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} signalements actifs.`
              : `Reactivation blocked while ${payload.activeReportCount ?? PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} active reports remain.`
          );
        }
        throw new Error(
          isFr ? "Impossible de reactiver l'annonce." : "Unable to reactivate listing."
        );
      }

      await load();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isFr
            ? "Impossible de reactiver l'annonce."
            : "Unable to reactivate listing."
      );
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = items.filter(
    (item) => item.status === "PENDING" || item.status === "UNDER_REVIEW"
  ).length;

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-rose-200/85">
            {isFr ? "Signalements annonces" : "Listing reports"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {isFr ? "Moderer les annonces signalees" : "Review reported listings"}
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            {isFr
              ? "Visuel, motif et contexte du report au meme endroit."
              : "Listing visual, reason and context in one place."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-200">
            {isFr ? `${pendingCount} a traiter` : `${pendingCount} to review`}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            {isFr ? "Actualiser" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-zinc-400">{isFr ? "Chargement..." : "Loading..."}</p> : null}

      {!loading && items.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">
          {isFr ? "Aucun signalement d'annonce pour le moment." : "No listing reports yet."}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {items.map((item) => {
            const statusMeta = STATUS_LABELS[item.status];
            const currentProduct = item.product;
            const canReactivate = currentProduct
              ? !currentProduct.isActive &&
                currentProduct.activeReportCount < PRODUCT_REPORT_AUTO_HIDE_THRESHOLD
              : false;
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/55 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="h-20 w-24 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                      {item.product?.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white">
                        {item.product?.title ?? (isFr ? "Annonce supprimee" : "Deleted listing")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {item.product?.sellerName ??
                          (isFr ? "Vendeur inconnu" : "Unknown seller")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] ${statusMeta.className}`}>
                          {statusMeta[isFr ? "fr" : "en"]}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300">
                          {(REASON_LABELS[item.reason] ?? REASON_LABELS.OTHER)[isFr ? "fr" : "en"]}
                        </span>
                        {item.product ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-100">
                            {isFr
                              ? `${item.product.activeReportCount} signalement(s) actifs`
                              : `${item.product.activeReportCount} active report(s)`}
                          </span>
                        ) : null}
                        {item.product?.autoHiddenByReports ? (
                          <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] text-rose-100">
                            {isFr
                              ? `Annonce masquee auto (>=${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD})`
                              : `Listing auto-hidden (>=${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD})`}
                          </span>
                        ) : null}
                        {item.product ? (
                          <a
                            href={`/${locale}/shop/${item.product.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300 transition hover:border-white/20 hover:text-white"
                          >
                            {isFr ? "Voir l'annonce" : "Open listing"}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs text-zinc-400">
                    <p>{item.reporter.name ?? item.reporter.email ?? item.reporter.id}</p>
                    <p className="mt-1">{new Date(item.createdAt).toLocaleString(locale)}</p>
                  </div>
                </div>

                {item.description ? (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                    {item.description}
                  </p>
                ) : null}

                {item.product?.autoHiddenAt ? (
                  <p className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-400/8 px-4 py-3 text-sm text-rose-100/90">
                    {isFr
                      ? `Masquee automatiquement le ${new Date(item.product.autoHiddenAt).toLocaleString(locale)} apres ${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} signalements actifs.`
                      : `Automatically hidden on ${new Date(item.product.autoHiddenAt).toLocaleString(locale)} after ${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} active reports.`}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {isFr ? "Note admin" : "Admin note"}
                    </span>
                    <textarea
                      rows={2}
                      value={noteDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/30"
                      placeholder={
                        isFr
                          ? "Contexte moderation / action prise"
                          : "Moderation context / action taken"
                      }
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {item.product && !item.product.isActive ? (
                      <button
                        type="button"
                        onClick={() => void reactivateListing(item)}
                        disabled={busyId === item.id || !canReactivate}
                        className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isFr ? "Reactiver l'annonce" : "Reactivate listing"}
                      </button>
                    ) : null}
                    {(["UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void patchItem(item, status)}
                        disabled={busyId === item.id}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {STATUS_LABELS[status][isFr ? "fr" : "en"]}
                      </button>
                    ))}
                  </div>
                </div>

                {item.product && !item.product.isActive && !canReactivate ? (
                  <p className="mt-3 text-xs text-amber-200/90">
                    {isFr
                      ? `Reactivation bloquee tant que l'annonce garde au moins ${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} signalements actifs.`
                      : `Reactivation stays blocked while the listing still has at least ${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} active reports.`}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
