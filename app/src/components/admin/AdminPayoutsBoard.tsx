"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";

type PayoutStatus = "PENDING" | "PAID" | "FAILED";

type PayoutItem = {
  id: string;
  sellerId: string;
  orderId?: string | null;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  providerRef?: string | null;
  createdAt: string;
  seller: {
    id: string;
    displayName: string;
    slug: string;
    payoutAccountRef?: string | null;
    user?: {
      email: string;
      name?: string | null;
    } | null;
  };
  order?: {
    id: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    currency: string;
    createdAt: string;
    buyerName?: string | null;
    buyerEmail?: string | null;
  } | null;
};

type PayoutSummary = {
  totalCount: number;
  pendingCount: number;
  paidCount: number;
  failedCount: number;
  pendingCents: number;
  paidCents: number;
  failedCents: number;
};

type PayoutResponse = {
  items: PayoutItem[];
  summary: PayoutSummary;
};

const statusOptions: PayoutStatus[] = ["PENDING", "PAID", "FAILED"];

const emptySummary: PayoutSummary = {
  totalCount: 0,
  pendingCount: 0,
  paidCount: 0,
  failedCount: 0,
  pendingCents: 0,
  paidCents: 0,
  failedCents: 0,
};

export default function AdminPayoutsBoard() {
  const locale = useLocale();

  const [items, setItems] = useState<PayoutItem[]>([]);
  const [summary, setSummary] = useState<PayoutSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [edits, setEdits] = useState<
    Record<string, { status: PayoutStatus; providerRef: string }>
  >({});

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadPayouts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("take", "120");
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/admin/payouts?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Impossible de charger les payouts");
      }

      const payload = (await response.json()) as PayoutResponse;
      setItems(payload.items);
      setSummary(payload.summary);

      const nextEdits: Record<string, { status: PayoutStatus; providerRef: string }> = {};
      for (const item of payload.items) {
        nextEdits[item.id] = {
          status: item.status,
          providerRef: item.providerRef ?? "",
        };
      }
      setEdits(nextEdits);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les payouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const updatePayout = async (id: string) => {
    const current = edits[id];
    if (!current) return;

    setSavingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: current.status,
          providerRef: current.providerRef,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Mise a jour payout impossible");
      }

      await loadPayouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour payout impossible");
    } finally {
      setSavingId(null);
    }
  };

  const markSelectedPaid = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/payouts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: "PAID" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Action bulk impossible");
      }

      await loadPayouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action bulk impossible");
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((item) => item.id));
      return;
    }
    setSelectedIds([]);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const exportCsv = () => {
    const header = [
      "payout_id",
      "status",
      "amount_cents",
      "currency",
      "provider_ref",
      "seller_id",
      "seller_name",
      "seller_slug",
      "seller_email",
      "order_id",
      "order_status",
      "order_payment_status",
      "buyer_email",
      "created_at",
    ];

    const escapeCell = (value: unknown) => {
      const text = String(value ?? "");
      const escaped = text.replaceAll('"', '""');
      return `"${escaped}"`;
    };

    const rows = items.map((item) => [
      item.id,
      item.status,
      item.amountCents,
      item.currency,
      item.providerRef ?? "",
      item.seller.id,
      item.seller.displayName,
      item.seller.slug,
      item.seller.user?.email ?? "",
      item.order?.id ?? item.orderId ?? "",
      item.order?.status ?? "",
      item.order?.paymentStatus ?? "",
      item.order?.buyerEmail ?? "",
      item.createdAt,
    ]);

    const lines = [header, ...rows].map((line) => line.map(escapeCell).join(","));
    const csv = `\uFEFF${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jontaado-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const totalAmount =
    summary.pendingCents + summary.paidCents + summary.failedCents;

  const allVisibleSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payouts</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Suivi des virements vendeurs sans modifier le dashboard principal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={loadPayouts}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            Rafraichir
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-xs sm:grid-cols-3">
        <input
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          placeholder="Rechercher vendeur / email / order / ref"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">Tous les statuts</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadPayouts}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          Filtrer
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
          <p className="text-[11px] text-zinc-400">Total virements</p>
          <p className="mt-2 text-lg font-semibold text-white">{summary.totalCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {formatMoney(totalAmount, "XOF", locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
          <p className="text-[11px] text-zinc-400">Pending</p>
          <p className="mt-2 text-lg font-semibold text-amber-200">{summary.pendingCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {formatMoney(summary.pendingCents, "XOF", locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
          <p className="text-[11px] text-zinc-400">Paid</p>
          <p className="mt-2 text-lg font-semibold text-emerald-200">{summary.paidCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {formatMoney(summary.paidCents, "XOF", locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
          <p className="text-[11px] text-zinc-400">Failed</p>
          <p className="mt-2 text-lg font-semibold text-rose-200">{summary.failedCount}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {formatMoney(summary.failedCents, "XOF", locale)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/50 p-3 text-xs text-zinc-300">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={(event) => toggleSelectAll(event.target.checked)}
          />
          Tout selectionner (visible)
        </label>
        <span className="text-zinc-400">Selection: {selectedIds.length}</span>
        <button
          type="button"
          disabled={selectedIds.length === 0 || bulkSaving}
          onClick={markSelectedPaid}
          className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60"
        >
          {bulkSaving ? "Traitement..." : "Marquer selection en PAID"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-400">Chargement...</p>}

      {!loading && items.length === 0 && (
        <p className="mt-6 text-sm text-zinc-400">Aucun payout trouve.</p>
      )}

      {items.length > 0 && (
        <div className="mt-6 grid gap-4">
          {items.map((payout) => {
            const edit = edits[payout.id] ?? {
              status: payout.status,
              providerRef: payout.providerRef ?? "",
            };

            return (
              <div
                key={payout.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedSet.has(payout.id)}
                      onChange={(event) => toggleSelectOne(payout.id, event.target.checked)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">{payout.seller.displayName}</p>
                      <p className="mt-1 text-xs text-zinc-500">/{payout.seller.slug}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {payout.seller.user?.email ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-300">
                    <p>{formatMoney(payout.amountCents, payout.currency, locale)}</p>
                    <p className="mt-1 text-zinc-400">{payout.status}</p>
                    <p className="mt-1 text-zinc-500">
                      {new Date(payout.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                  <p>
                    Payout ref: <span className="text-zinc-200">{payout.providerRef ?? "-"}</span>
                  </p>
                  <p>
                    Seller payout ref:{" "}
                    <span className="text-zinc-200">{payout.seller.payoutAccountRef ?? "-"}</span>
                  </p>
                </div>

                {payout.order && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>
                        Order: <span className="text-zinc-100">{payout.order.id.slice(0, 12)}...</span>
                      </p>
                      <a
                        href={`/${locale}/admin/orders/${payout.order.id}`}
                        className="text-emerald-300 underline"
                      >
                        Voir commande
                      </a>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px] text-zinc-400 sm:grid-cols-2">
                      <p>Status: {payout.order.status}</p>
                      <p>Payment: {payout.order.paymentStatus}</p>
                      <p>
                        Buyer: {payout.order.buyerName || payout.order.buyerEmail || "-"}
                      </p>
                      <p>
                        Total: {formatMoney(payout.order.totalCents, payout.order.currency, locale)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-2 md:grid-cols-[180px_1fr_auto]">
                  <select
                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
                    value={edit.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as PayoutStatus;
                      setEdits((prev) => ({
                        ...prev,
                        [payout.id]: {
                          ...(prev[payout.id] ?? {
                            status: payout.status,
                            providerRef: payout.providerRef ?? "",
                          }),
                          status: nextStatus,
                        },
                      }));
                    }}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <input
                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
                    placeholder="Provider reference"
                    value={edit.providerRef}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEdits((prev) => ({
                        ...prev,
                        [payout.id]: {
                          ...(prev[payout.id] ?? {
                            status: payout.status,
                            providerRef: payout.providerRef ?? "",
                          }),
                          providerRef: value,
                        },
                      }));
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => updatePayout(payout.id)}
                    disabled={savingId === payout.id}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                  >
                    {savingId === payout.id ? "Sauvegarde..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
