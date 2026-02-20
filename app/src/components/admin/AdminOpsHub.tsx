"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";

type OpsKpis = {
  payoutsReady: number | null;
  disputesOpen: number | null;
  paymentsFailed7d: number | null;
  kycPending: number | null;
};

type OpsQueueItem = {
  type: "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED" | "KYC" | "GP_PROOF";
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

export default function AdminOpsHub({ kpis, queueItems }: Props) {
  const [pendingRelease, setPendingRelease] = useState<Record<string, boolean>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [errorByItem, setErrorByItem] = useState<Record<string, string>>({});

  const cards = useMemo(
    () => [
      { key: "payouts", label: "Payouts READY", value: kpis.payoutsReady, href: "/admin?ops=PAYOUT" },
      { key: "disputes", label: "Disputes OPEN", value: kpis.disputesOpen, href: "/admin?ops=DISPUTE" },
      {
        key: "payments",
        label: "Payments FAILED (7j)",
        value: kpis.paymentsFailed7d,
        href: "/admin?ops=PAYMENT_FAILED",
      },
      { key: "kyc", label: "KYC en attente", value: kpis.kycPending, href: "/admin/kyc" },
    ],
    [kpis]
  );

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
          <p className="mt-1 text-sm text-zinc-300">Priorites PRESTA / TIAK / GP / Paiements</p>
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

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/40">
        <div className="border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">A traiter maintenant</h3>
        </div>
        <div className="divide-y divide-white/5">
          {queueItems.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">Aucun item urgent.</div>
          ) : (
            queueItems.map((item) => {
              const currentStatus = statusOverrides[item.id] ?? item.status;
              const action = item.action;
              const actionBusy = pendingRelease[item.id] === true;

              return (
                <div key={`${item.type}-${item.id}`} className="grid gap-2 px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)_120px_100px_auto] md:items-center">
                  <span className="text-xs font-semibold text-sky-200">{item.type}</span>
                  <span className="text-xs text-zinc-300">{item.refLabel}</span>
                  <span className="text-xs text-zinc-200">{currentStatus}</span>
                  <span className="text-xs text-zinc-500">{item.ageLabel}</span>
                  <div className="flex items-center justify-end gap-2">
                    {item.amountLabel ? <span className="text-xs text-emerald-200">{item.amountLabel}</span> : null}
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
                    <p className="md:col-span-5 text-xs text-rose-300">{errorByItem[item.id]}</p>
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
