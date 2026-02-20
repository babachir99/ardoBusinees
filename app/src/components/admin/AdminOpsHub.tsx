"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

type OpsKpis = {
  payoutsReady: number | null;
  disputesActive: number | null;
  paymentsFailed7d: number | null;
  kycPending: number | null;
};

type OpsQueueItem = {
  type: "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED";
  id: string;
  refLabel: string;
  status: string;
  ageLabel: string;
  amountLabel?: string | null;
  action:
    | { kind: "release"; label: string; releaseType: "PRESTA" | "TIAK" }
    | { kind: "link"; label: string; href: string };
};

type Props = {
  kpis: OpsKpis;
  queueItems: OpsQueueItem[];
};

type QueueFilter = "ALL" | "PAYOUTS" | "DISPUTES" | "PAYMENTS_FAILED";

function normalizeFilter(value: string | null): QueueFilter {
  if (value === "PAYOUTS" || value === "DISPUTES" || value === "PAYMENTS_FAILED") {
    return value;
  }
  return "ALL";
}

export default function AdminOpsHub({ kpis, queueItems }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = normalizeFilter(searchParams.get("opsFilter"));

  const [pendingRelease, setPendingRelease] = useState<Record<string, boolean>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [errorByItem, setErrorByItem] = useState<Record<string, string>>({});

  const cards = useMemo(
    () => [
      {
        key: "payouts",
        label: "PAYOUTS READY",
        value: kpis.payoutsReady,
        href: { pathname: "/admin", query: { opsFilter: "PAYOUTS" } },
      },
      {
        key: "disputes",
        label: "DISPUTES ACTIVE",
        value: kpis.disputesActive,
        href: { pathname: "/admin", query: { opsFilter: "DISPUTES" } },
      },
      {
        key: "payments",
        label: "PAYMENTS FAILED (7J)",
        value: kpis.paymentsFailed7d,
        href: { pathname: "/admin", query: { opsFilter: "PAYMENTS_FAILED" } },
      },
      {
        key: "kyc",
        label: "KYC PENDING",
        value: kpis.kycPending,
        href: "/admin/kyc",
      },
    ].filter((card) => card.key !== "kyc" || typeof card.value === "number"),
    [kpis]
  );

  const filterTabs: Array<{ key: QueueFilter; label: string }> = [
    { key: "ALL", label: "ALL" },
    { key: "PAYOUTS", label: "PAYOUTS" },
    { key: "DISPUTES", label: "DISPUTES" },
    { key: "PAYMENTS_FAILED", label: "PAYMENTS FAILED" },
  ];

  const filteredQueue = useMemo(() => {
    if (activeFilter === "ALL") return queueItems;
    if (activeFilter === "PAYOUTS") return queueItems.filter((item) => item.type === "PAYOUT");
    if (activeFilter === "DISPUTES") return queueItems.filter((item) => item.type === "DISPUTE");
    return queueItems.filter((item) => item.type === "PAYMENT_FAILED");
  }, [activeFilter, queueItems]);

  async function handleRelease(item: OpsQueueItem) {
    if (item.action.kind !== "release") return;

    setPendingRelease((prev) => ({ ...prev, [item.id]: true }));
    setErrorByItem((prev) => ({ ...prev, [item.id]: "" }));

    try {
      const response = await fetch("/api/admin/payouts/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.action.releaseType, payoutId: item.id }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setErrorByItem((prev) => ({ ...prev, [item.id]: body.message ?? "Action impossible." }));
        return;
      }

      setStatusOverrides((prev) => ({ ...prev, [item.id]: "PAID" }));
      router.refresh();
    } catch {
      setErrorByItem((prev) => ({ ...prev, [item.id]: "Action impossible." }));
    } finally {
      setPendingRelease((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Ops Hub</h2>
          <p className="mt-1 text-sm text-zinc-300">KPI ops et file d'action admin</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 transition hover:border-white/30"
          >
            <p className="text-xs text-zinc-400">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{typeof card.value === "number" ? card.value : "-"}</p>
          </Link>
        ))}
      </div>

      <div id="ops-queue" className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/40">
        <div className="border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">A traiter maintenant</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <Link
                key={tab.key}
                href={{ pathname: "/admin", query: tab.key === "ALL" ? {} : { opsFilter: tab.key } }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activeFilter === tab.key
                    ? "border-sky-300/60 bg-sky-300/20 text-sky-100"
                    : "border-white/20 text-white hover:border-white/50"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-[100px_minmax(0,1fr)_120px_140px_80px_auto] border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          <span>Type</span>
          <span>Ref</span>
          <span>Status</span>
          <span>Amount</span>
          <span>Age</span>
          <span className="text-right">Action</span>
        </div>

        <div className="divide-y divide-white/5">
          {filteredQueue.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">Aucun item urgent.</div>
          ) : (
            filteredQueue.map((item) => {
              const currentStatus = statusOverrides[item.id] ?? item.status;
              const action = item.action;
              const actionBusy = pendingRelease[item.id] === true;

              return (
                <div key={`${item.type}-${item.id}`} className="grid gap-2 px-4 py-3 md:grid-cols-[100px_minmax(0,1fr)_120px_140px_80px_auto] md:items-center">
                  <span className="text-xs font-semibold text-sky-200">{item.type}</span>
                  <span className="text-xs text-zinc-300">{item.refLabel}</span>
                  <span className="text-xs text-zinc-200">{currentStatus}</span>
                  <span className="text-xs text-emerald-200">{item.amountLabel ?? "-"}</span>
                  <span className="text-xs text-zinc-500">{item.ageLabel}</span>
                  <div className="flex items-center justify-end gap-2">
                    {action.kind === "release" ? (
                      <button
                        type="button"
                        onClick={() => void handleRelease(item)}
                        disabled={actionBusy || currentStatus === "PAID"}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {currentStatus === "PAID" ? "Released" : actionBusy ? "..." : action.label}
                      </button>
                    ) : (
                      <Link
                        href={action.href}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50"
                      >
                        {action.label}
                      </Link>
                    )}
                  </div>
                  {errorByItem[item.id] ? (
                    <p className="md:col-span-6 text-xs text-rose-300">{errorByItem[item.id]}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
