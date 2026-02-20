"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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

type ReconciliationFindings = {
  confirmedLedgerMissingPayout: Array<{
    ledgerId: string;
    contextType: string;
    contextId: string;
    payoutStatus: string | null;
    amountTotalCents: number;
    currency: string;
    createdAt: string;
  }>;
  payoutReadyButActiveDispute: Array<{
    payoutType: "PRESTA" | "TIAK";
    payoutId: string;
    contextType: string;
    contextId: string;
    payoutStatus: string;
    disputeId: string;
    disputeStatus: string;
    amountTotalCents: number;
    currency: string;
    createdAt: string;
  }>;
  orderPaidButLedgerNotConfirmed: Array<{
    orderId: string;
    orderPaymentStatus: string;
    paymentStatus: string | null;
    ledgerStatus: string | null;
    amountTotalCents: number;
    currency: string;
    createdAt: string;
  }>;
};

type Props = {
  kpis: OpsKpis;
  queueItems: OpsQueueItem[];
};

type QueueFilter = "ALL" | "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED";

function normalizeFilter(value: string | null): QueueFilter {
  if (value === "PAYOUT" || value === "DISPUTE" || value === "PAYMENT_FAILED") {
    return value;
  }
  return "ALL";
}

export default function AdminOpsHub({ kpis, queueItems }: Props) {
  const t = useTranslations("Admin.opsHub");
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = normalizeFilter(searchParams.get("opsFilter"));

  const [pendingRelease, setPendingRelease] = useState<Record<string, boolean>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [errorByItem, setErrorByItem] = useState<Record<string, string>>({});

  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState("");
  const [reconData, setReconData] = useState<ReconciliationFindings | null>(null);

  const cards = useMemo(
    () => [
      {
        key: "payouts",
        label: t("cards.payoutsReady"),
        value: kpis.payoutsReady,
        href: { pathname: "/admin", query: { opsFilter: "PAYOUT" } },
      },
      {
        key: "disputes",
        label: t("cards.disputesActive"),
        value: kpis.disputesActive,
        href: { pathname: "/admin", query: { opsFilter: "DISPUTE" } },
      },
      {
        key: "payments",
        label: t("cards.paymentsFailed7d"),
        value: kpis.paymentsFailed7d,
        href: { pathname: "/admin", query: { opsFilter: "PAYMENT_FAILED" } },
      },
      {
        key: "kyc",
        label: t("cards.kycPending"),
        value: kpis.kycPending,
        href: "/admin/kyc",
      },
    ].filter((card) => card.key !== "kyc" || typeof card.value === "number"),
    [kpis, t]
  );

  const filterTabs: Array<{ key: QueueFilter; label: string }> = [
    { key: "ALL", label: t("filters.all") },
    { key: "PAYOUT", label: t("filters.payouts") },
    { key: "DISPUTE", label: t("filters.disputes") },
    { key: "PAYMENT_FAILED", label: t("filters.paymentsFailed") },
  ];

  const typeLabels: Record<OpsQueueItem["type"], string> = {
    PAYOUT: t("queue.types.payout"),
    DISPUTE: t("queue.types.dispute"),
    PAYMENT_FAILED: t("queue.types.paymentFailed"),
  };

  const statusLabels: Record<string, string> = {
    READY: t("statuses.READY"),
    PAID: t("statuses.PAID"),
    FAILED: t("statuses.FAILED"),
    PENDING: t("statuses.PENDING"),
    OPEN: t("statuses.OPEN"),
    IN_REVIEW: t("statuses.IN_REVIEW"),
    CONFIRMED: t("statuses.CONFIRMED"),
    INITIATED: t("statuses.INITIATED"),
  };

  const filteredQueue = useMemo(() => {
    if (activeFilter === "ALL") return queueItems;
    if (activeFilter === "PAYOUT") return queueItems.filter((item) => item.type === "PAYOUT");
    if (activeFilter === "DISPUTE") return queueItems.filter((item) => item.type === "DISPUTE");
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

      if (response.status === 409) {
        setErrorByItem((prev) => ({
          ...prev,
          [item.id]: t("messages.releaseBlocked"),
        }));
        router.refresh();
        return;
      }

      if (!response.ok) {
        setErrorByItem((prev) => ({ ...prev, [item.id]: t("messages.releaseFailed") }));
        return;
      }

      setStatusOverrides((prev) => ({ ...prev, [item.id]: "PAID" }));
      router.refresh();
    } catch {
      setErrorByItem((prev) => ({ ...prev, [item.id]: t("messages.releaseFailed") }));
    } finally {
      setPendingRelease((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleRunReconciliation() {
    setReconLoading(true);
    setReconError("");

    try {
      const response = await fetch("/api/admin/reconciliation/dry-run", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setReconError(t("messages.dryRunFailed"));
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { findings?: ReconciliationFindings }
        | null;

      if (!body?.findings) {
        setReconError(t("messages.dryRunFailed"));
        return;
      }

      setReconData(body.findings);
    } catch {
      setReconError(t("messages.dryRunFailed"));
    } finally {
      setReconLoading(false);
    }
  }

  const reconCounts = {
    confirmedLedgerMissingPayout: reconData?.confirmedLedgerMissingPayout.length ?? 0,
    payoutReadyButActiveDispute: reconData?.payoutReadyButActiveDispute.length ?? 0,
    orderPaidButLedgerNotConfirmed: reconData?.orderPaidButLedgerNotConfirmed.length ?? 0,
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-300">{t("subtitle")}</p>
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
          <h3 className="text-sm font-semibold text-white">{t("queue.title")}</h3>
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
          <span>{t("queue.columns.type")}</span>
          <span>{t("queue.columns.ref")}</span>
          <span>{t("queue.columns.status")}</span>
          <span>{t("queue.columns.amount")}</span>
          <span>{t("queue.columns.age")}</span>
          <span className="text-right">{t("queue.columns.action")}</span>
        </div>

        <div className="divide-y divide-white/5">
          {filteredQueue.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">{t("queue.empty")}</div>
          ) : (
            filteredQueue.map((item) => {
              const currentStatus = statusOverrides[item.id] ?? item.status;
              const action = item.action;
              const actionBusy = pendingRelease[item.id] === true;

              return (
                <div key={`${item.type}-${item.id}`} className="grid gap-2 px-4 py-3 md:grid-cols-[100px_minmax(0,1fr)_120px_140px_80px_auto] md:items-center">
                  <span className="text-xs font-semibold text-sky-200">{typeLabels[item.type]}</span>
                  <span className="text-xs text-zinc-300">{item.refLabel}</span>
                  <span className="text-xs text-zinc-200">{statusLabels[currentStatus] ?? currentStatus}</span>
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
                        {currentStatus === "PAID" ? t("actions.released") : actionBusy ? "..." : action.label}
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

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{t("reconciliation.title")}</h3>
          <button
            type="button"
            onClick={() => void handleRunReconciliation()}
            disabled={reconLoading}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reconLoading ? t("reconciliation.running") : t("reconciliation.run")}
          </button>
        </div>

        {reconError ? <p className="mt-3 text-xs text-rose-300">{reconError}</p> : null}

        {reconData ? (
          <div className="mt-4 grid gap-3">
            <details className="rounded-xl border border-white/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-white">
                {t("reconciliation.sections.confirmedLedgerMissingPayout")} ({reconCounts.confirmedLedgerMissingPayout})
              </summary>
              <div className="mt-2 space-y-1 text-xs text-zinc-300">
                {reconData.confirmedLedgerMissingPayout.length === 0 ? (
                  <p className="text-zinc-500">{t("reconciliation.noFindings")}</p>
                ) : (
                  reconData.confirmedLedgerMissingPayout.map((item) => (
                    <p key={item.ledgerId}>{item.contextType} {item.contextId} | {item.payoutStatus ?? "NO_PAYOUT"}</p>
                  ))
                )}
              </div>
            </details>

            <details className="rounded-xl border border-white/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-white">
                {t("reconciliation.sections.payoutReadyButActiveDispute")} ({reconCounts.payoutReadyButActiveDispute})
              </summary>
              <div className="mt-2 space-y-1 text-xs text-zinc-300">
                {reconData.payoutReadyButActiveDispute.length === 0 ? (
                  <p className="text-zinc-500">{t("reconciliation.noFindings")}</p>
                ) : (
                  reconData.payoutReadyButActiveDispute.map((item) => (
                    <p key={item.payoutId}>{item.payoutType} {item.contextId} | {item.disputeStatus}</p>
                  ))
                )}
              </div>
            </details>

            <details className="rounded-xl border border-white/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-white">
                {t("reconciliation.sections.orderPaidButLedgerNotConfirmed")} ({reconCounts.orderPaidButLedgerNotConfirmed})
              </summary>
              <div className="mt-2 space-y-1 text-xs text-zinc-300">
                {reconData.orderPaidButLedgerNotConfirmed.length === 0 ? (
                  <p className="text-zinc-500">{t("reconciliation.noFindings")}</p>
                ) : (
                  reconData.orderPaidButLedgerNotConfirmed.map((item) => (
                    <p key={item.orderId}>{item.orderId} | ledger={item.ledgerStatus ?? "MISSING"}</p>
                  ))
                )}
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}
