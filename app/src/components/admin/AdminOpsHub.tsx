"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

type OpsKpis = {
  payoutsReady: number | null;
  disputesActive: number | null;
  paymentsFailed7d: number | null;
  pendingOrders: number | null;
  inactiveProducts: number | null;
  kycPending: number | null;
  immoMonetizationIssues: number | null;
  autoMonetizationIssues: number | null;
  carsMonetizationIssues: number | null;
  trustReportsPending: number | null;
  trustDisputesActive: number | null;
};

type OpsQueueItem = {
  type: "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED" | "IMMO_MONETIZATION" | "AUTO_MONETIZATION" | "CARS_MONETIZATION" | "TRUST";
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

type NotificationsHealth = {
  counts: {
    PENDING: number;
    SENT: number;
    FAILED: number;
    CANCELLED: number;
  };
  oldestPendingAgeSeconds: number | null;
  failedLast24h: number;
  sentLast24h: number;
  topTemplateFailures: Array<{
    templateKey: string;
    count: number;
  }>;
};

type OpsInsightProduct = {
  id: string;
  title: string;
  sellerName: string;
  units: number;
  barPercent: number;
};

type OpsInsightSeller = {
  id: string;
  name: string;
  orders: number;
  revenueLabel: string;
  barPercent: number;
};

type OpsInsights = {
  products: OpsInsightProduct[];
  sellers: OpsInsightSeller[];
  productsHref: string;
  sellersHref: string;
};

type Props = {
  kpis: OpsKpis;
  queueItems: OpsQueueItem[];
  insights?: OpsInsights;
};

type QueueFilter = "ALL" | "PAYOUT" | "DISPUTE" | "PAYMENT_FAILED" | "IMMO_MONETIZATION" | "AUTO_MONETIZATION" | "CARS_MONETIZATION" | "TRUST";

function normalizeFilter(value: string | null): QueueFilter {
  if (value === "PAYOUT" || value === "DISPUTE" || value === "PAYMENT_FAILED" || value === "IMMO_MONETIZATION" || value === "AUTO_MONETIZATION" || value === "CARS_MONETIZATION" || value === "TRUST") {
    return value;
  }
  return "ALL";
}


function ageLabelToMinutes(ageLabel: string): number {
  const value = Number.parseInt(ageLabel, 10);
  if (!Number.isFinite(value) || value < 0) return 0;
  if (ageLabel.endsWith("j")) return value * 24 * 60;
  if (ageLabel.endsWith("h")) return value * 60;
  return value;
}

function getQueuePriority(item: OpsQueueItem): "URGENT" | "HIGH" | "NORMAL" {
  const ageMinutes = ageLabelToMinutes(item.ageLabel);
  if (ageMinutes >= 48 * 60) return "URGENT";
  if (item.type === "DISPUTE" || item.type === "TRUST" || item.type === "PAYMENT_FAILED") return "HIGH";
  return "NORMAL";
}

type AlertSeverity = "WARN" | "CRITICAL";

type OpsAlert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  href?: string;
  actionLabel?: string;
};

const ALERT_THRESHOLDS = {
  PAYOUTS_READY: 10,
  DISPUTES_ACTIVE: 3,
  PAYMENTS_FAILED_7D: 5,
  KYC_PENDING: 20,
  TRUST_REPORTS_PENDING: 5,
  TRUST_DISPUTES_ACTIVE: 3,
} as const;

const NOTIFICATION_ALERT_THRESHOLDS = {
  FAILED_24H_WARN: 5,
  FAILED_24H_CRITICAL: 20,
  OLDEST_PENDING_WARN_SECONDS: 60 * 60,
  OLDEST_PENDING_CRITICAL_SECONDS: 6 * 60 * 60,
  TOP_TEMPLATE_FAILURE_WARN: 5,
} as const;

export default function AdminOpsHub({ kpis, queueItems, insights }: Props) {
  const t = useTranslations("Admin.opsHub");
  const locale = useLocale();
  const isFr = locale.toLowerCase().startsWith("fr");
  const uiText = useMemo(
    () => ({
      trustReportsPending: isFr ? "Signalements trust (en attente)" : "Trust Reports (Pending)",
      trustDisputesActive: isFr ? "Litiges trust (ouverts/en revue)" : "Trust Disputes (Open/In review)",
      immoMonetization: isFr ? "Monetisation IMMO (EN_ATTENTE/ECHEC)" : "IMMO Monetization (PENDING/FAILED)",
      autoMonetization: isFr ? "Monetisation AUTO (EN_ATTENTE/ECHEC)" : "AUTO Monetization (PENDING/FAILED)",
      carsMonetization: isFr ? "Monetisation CARS (EN_ATTENTE/ECHEC)" : "CARS Monetization (PENDING/FAILED)",
      immoMonetizationTab: isFr ? "Monetisation IMMO" : "IMMO monetization",
      autoMonetizationTab: isFr ? "Monetisation AUTO" : "AUTO monetization",
      carsMonetizationTab: isFr ? "Monetisation CARS" : "CARS monetization",
      pendingOrders: isFr ? "Commandes en attente" : "Pending orders",
      inactiveProducts: isFr ? "Produits inactifs" : "Inactive products",
      trustTab: isFr ? "Trust" : "Trust",
      trustModeration: isFr ? "Moderation trust" : "Trust moderation",
      trustReportsAlert: isFr ? "Signalements trust en attente" : "Trust reports pending",
      trustDisputesAlert: isFr ? "Litiges trust actifs" : "Trust disputes active",
      notificationsFailed24h: isFr ? "Notifications en echec (24h)" : "Notifications failed (24h)",
      oldestPendingAge: isFr ? "Age max notification en attente" : "Oldest pending notification age",
      openNotificationsHealth: isFr ? "Ouvrir la sante notifications" : "Open notifications health",
      templateFailures: isFr ? "Echecs de template" : "Template failures",
      notificationHealthUnavailable: isFr ? "Sante notifications indisponible." : "Notification health unavailable.",
      notificationsHealthTitle: isFr ? "Sante des notifications" : "Notifications health",
      notificationsHealthSubtitle: isFr ? "Metriques outbox en lecture seule (sans PII)." : "Read-only outbox health metrics (no PII).",
      notificationsRefreshing: isFr ? "Actualisation..." : "Refreshing...",
      notificationsRefresh: isFr ? "Actualiser" : "Refresh",
      notificationsLoad: isFr ? "Charger" : "Load",
      pendingLabel: isFr ? "EN ATTENTE" : "PENDING",
      failed24hLabel: isFr ? "ECHEC (24h)" : "FAILED (24h)",
      sent24hLabel: isFr ? "ENVOYE (24h)" : "SENT (24h)",
      oldestPendingAgeLabel: isFr ? "Age max en attente" : "Oldest pending age",
      loadNotificationHealthHint: isFr ? "Chargez la sante notifications pour voir les echecs et l'anciennete de file." : "Load notification health to view failures and queue age.",
      topTemplateFailuresTitle: isFr ? "Top des echecs de template" : "Top template failures",
    }),
    [isFr]
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = normalizeFilter(searchParams.get("opsFilter"));
  const focusItemId = searchParams.get("focus") ?? "";

  const [pendingRelease, setPendingRelease] = useState<Record<string, boolean>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [errorByItem, setErrorByItem] = useState<Record<string, string>>({});

  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState("");
  const [reconData, setReconData] = useState<ReconciliationFindings | null>(null);

  const [notificationsHealth, setNotificationsHealth] = useState<NotificationsHealth | null>(null);
  const [notificationsHealthLoading, setNotificationsHealthLoading] = useState(false);
  const [notificationsHealthError, setNotificationsHealthError] = useState("");
  const [notificationsHealthLoaded, setNotificationsHealthLoaded] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const handleLoadNotificationsHealth = useCallback(async () => {
    setNotificationsHealthLoaded(true);
    setNotificationsHealthLoading(true);
    setNotificationsHealthError("");

    try {
      const response = await fetch("/api/admin/notifications/health", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setNotificationsHealthError(uiText.notificationHealthUnavailable);
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { health?: NotificationsHealth }
        | null;

      if (!body?.health) {
        setNotificationsHealthError(uiText.notificationHealthUnavailable);
        return;
      }

      setNotificationsHealth(body.health);
    } catch {
      setNotificationsHealthError(uiText.notificationHealthUnavailable);
    } finally {
      setNotificationsHealthLoading(false);
    }
  }, [uiText.notificationHealthUnavailable]);

  useEffect(() => {
    if (notificationsHealthLoaded || notificationsHealthLoading) return;
    void handleLoadNotificationsHealth();
  }, [handleLoadNotificationsHealth, notificationsHealthLoaded, notificationsHealthLoading]);

  useEffect(() => {
    if (!insightsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInsightsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [insightsOpen]);

  const warnFlags = useMemo(
    () => ({
      payoutsReady:
        typeof kpis.payoutsReady === "number" &&
        kpis.payoutsReady >= ALERT_THRESHOLDS.PAYOUTS_READY,
      disputesActive:
        typeof kpis.disputesActive === "number" &&
        kpis.disputesActive >= ALERT_THRESHOLDS.DISPUTES_ACTIVE,
      paymentsFailed7d:
        typeof kpis.paymentsFailed7d === "number" &&
        kpis.paymentsFailed7d >= ALERT_THRESHOLDS.PAYMENTS_FAILED_7D,
      kycPending:
        typeof kpis.kycPending === "number" &&
        kpis.kycPending >= ALERT_THRESHOLDS.KYC_PENDING,
      trustReportsPending:
        typeof kpis.trustReportsPending === "number" &&
        kpis.trustReportsPending >= ALERT_THRESHOLDS.TRUST_REPORTS_PENDING,
      trustDisputesActive:
        typeof kpis.trustDisputesActive === "number" &&
        kpis.trustDisputesActive >= ALERT_THRESHOLDS.TRUST_DISPUTES_ACTIVE,
    }),
    [kpis]
  );

  const cards = useMemo(
    () => [
      {
        key: "payouts",
        label: t("cards.payoutsReady"),
        value: kpis.payoutsReady,
        href: { pathname: "/admin", query: { opsFilter: "PAYOUT" } },
        filter: "PAYOUT" as QueueFilter,
        warn: warnFlags.payoutsReady,
      },
      {
        key: "disputes",
        label: t("cards.disputesActive"),
        value: kpis.disputesActive,
        href: { pathname: "/admin", query: { opsFilter: "DISPUTE" } },
        filter: "DISPUTE" as QueueFilter,
        warn: warnFlags.disputesActive,
      },
      {
        key: "payments",
        label: t("cards.paymentsFailed7d"),
        value: kpis.paymentsFailed7d,
        href: { pathname: "/admin", query: { opsFilter: "PAYMENT_FAILED" } },
        filter: "PAYMENT_FAILED" as QueueFilter,
        warn: warnFlags.paymentsFailed7d,
      },
      {
        key: "pendingOrders",
        label: uiText.pendingOrders,
        value: kpis.pendingOrders,
        href: "/admin/orders",
        filter: null,
        warn: typeof kpis.pendingOrders === "number" && kpis.pendingOrders > 0,
      },
      {
        key: "inactiveProducts",
        label: uiText.inactiveProducts,
        value: kpis.inactiveProducts,
        href: "/admin/products",
        filter: null,
        warn: typeof kpis.inactiveProducts === "number" && kpis.inactiveProducts > 0,
      },
      {
        key: "kyc",
        label: t("cards.kycPending"),
        value: kpis.kycPending,
        href: "/admin/kyc",
        filter: null,
        warn: warnFlags.kycPending,
      },
      {
        key: "trustReports",
        label: uiText.trustReportsPending,
        value: kpis.trustReportsPending,
        href: { pathname: "/admin", query: { opsFilter: "TRUST" } },
        filter: "TRUST" as QueueFilter,
        warn: typeof kpis.trustReportsPending === "number" && kpis.trustReportsPending > 0,
      },
      {
        key: "trustDisputes",
        label: uiText.trustDisputesActive,
        value: kpis.trustDisputesActive,
        href: { pathname: "/admin", query: { opsFilter: "TRUST" } },
        filter: "TRUST" as QueueFilter,
        warn: typeof kpis.trustDisputesActive === "number" && kpis.trustDisputesActive > 0,
      },
      {
        key: "immoMonetization",
        label: uiText.immoMonetization,
        value: kpis.immoMonetizationIssues,
        href: { pathname: "/admin", query: { opsFilter: "IMMO_MONETIZATION" } },
        filter: "IMMO_MONETIZATION" as QueueFilter,
        warn: typeof kpis.immoMonetizationIssues === "number" && kpis.immoMonetizationIssues > 0,
      },
      {
        key: "autoMonetization",
        label: uiText.autoMonetization,
        value: kpis.autoMonetizationIssues,
        href: { pathname: "/admin", query: { opsFilter: "AUTO_MONETIZATION" } },
        filter: "AUTO_MONETIZATION" as QueueFilter,
        warn: typeof kpis.autoMonetizationIssues === "number" && kpis.autoMonetizationIssues > 0,
      },
      {
        key: "carsMonetization",
        label: uiText.carsMonetization,
        value: kpis.carsMonetizationIssues,
        href: { pathname: "/admin", query: { opsFilter: "CARS_MONETIZATION" } },
        filter: "CARS_MONETIZATION" as QueueFilter,
        warn: typeof kpis.carsMonetizationIssues === "number" && kpis.carsMonetizationIssues > 0,
      },
    ].filter((card) => card.key !== "kyc" || typeof card.value === "number"),
    [kpis, t, uiText, warnFlags]
  );

  const filterTabs: Array<{ key: QueueFilter; label: string }> = [
    { key: "ALL", label: t("filters.all") },
    { key: "PAYOUT", label: t("filters.payouts") },
    { key: "DISPUTE", label: t("filters.disputes") },
    { key: "PAYMENT_FAILED", label: t("filters.paymentsFailed") },
    { key: "IMMO_MONETIZATION", label: uiText.immoMonetizationTab },
    { key: "AUTO_MONETIZATION", label: uiText.autoMonetizationTab },
    { key: "CARS_MONETIZATION", label: uiText.carsMonetizationTab },
    { key: "TRUST", label: uiText.trustTab },
  ];

  const typeLabels: Record<OpsQueueItem["type"], string> = {
    PAYOUT: t("queue.types.payout"),
    DISPUTE: t("queue.types.dispute"),
    PAYMENT_FAILED: t("queue.types.paymentFailed"),
    IMMO_MONETIZATION: uiText.immoMonetizationTab,
    AUTO_MONETIZATION: uiText.autoMonetizationTab,
    CARS_MONETIZATION: uiText.carsMonetizationTab,
    TRUST: uiText.trustModeration,
  };

  const statusLabels: Record<string, string> = {
    READY: t("statuses.READY"),
    PAID: t("statuses.PAID"),
    FAILED: t("statuses.FAILED"),
    PENDING: t("statuses.PENDING"),
    OPEN: t("statuses.OPEN"),
    IN_REVIEW: t("statuses.IN_REVIEW"),
    UNDER_REVIEW: t("statuses.IN_REVIEW"),
    CONFIRMED: t("statuses.CONFIRMED"),
    INITIATED: t("statuses.INITIATED"),
  };

  const queueGridCols = "grid grid-cols-[160px_1fr_110px_70px_110px_130px_160px] items-center gap-6";

  const filteredQueue = useMemo(() => {
    if (activeFilter === "ALL") return queueItems;
    if (activeFilter === "PAYOUT") return queueItems.filter((item) => item.type === "PAYOUT");
    if (activeFilter === "DISPUTE") return queueItems.filter((item) => item.type === "DISPUTE");
    if (activeFilter === "IMMO_MONETIZATION") return queueItems.filter((item) => item.type === "IMMO_MONETIZATION");
    if (activeFilter === "AUTO_MONETIZATION") return queueItems.filter((item) => item.type === "AUTO_MONETIZATION");
    if (activeFilter === "CARS_MONETIZATION") return queueItems.filter((item) => item.type === "CARS_MONETIZATION");
    if (activeFilter === "TRUST") return queueItems.filter((item) => item.type === "TRUST");
    return queueItems.filter((item) => item.type === "PAYMENT_FAILED");
  }, [activeFilter, queueItems]);

  const activeAlerts = useMemo<OpsAlert[]>(() => {
    const alerts: OpsAlert[] = [];

    if (warnFlags.payoutsReady && typeof kpis.payoutsReady === "number") {
      alerts.push({
        id: "warn-payouts",
        severity: "WARN",
        message: t("alerts.items.payoutsReady", { count: kpis.payoutsReady }),
        href: "/admin?opsFilter=PAYOUT#ops-queue",
        actionLabel: t("alerts.actions.openQueue"),
      });
    }

    if (warnFlags.disputesActive && typeof kpis.disputesActive === "number") {
      alerts.push({
        id: "warn-disputes",
        severity: "WARN",
        message: t("alerts.items.disputesActive", { count: kpis.disputesActive }),
        href: "/admin?opsFilter=DISPUTE#ops-queue",
        actionLabel: t("alerts.actions.openQueue"),
      });
    }

    if (warnFlags.paymentsFailed7d && typeof kpis.paymentsFailed7d === "number") {
      alerts.push({
        id: "warn-payments",
        severity: "WARN",
        message: t("alerts.items.paymentsFailed", { count: kpis.paymentsFailed7d }),
        href: "/admin?opsFilter=PAYMENT_FAILED#ops-queue",
        actionLabel: t("alerts.actions.openQueue"),
      });
    }

    if (warnFlags.kycPending && typeof kpis.kycPending === "number") {
      alerts.push({
        id: "warn-kyc",
        severity: "WARN",
        message: t("alerts.items.kycPending", { count: kpis.kycPending }),
        href: "/admin/kyc",
        actionLabel: t("alerts.actions.openKyc"),
      });
    }

    if (warnFlags.trustReportsPending && typeof kpis.trustReportsPending === "number") {
      alerts.push({
        id: "warn-trust-reports",
        severity: "WARN",
        message: `${uiText.trustReportsAlert}: ${kpis.trustReportsPending}`,
        href: "/admin?opsFilter=TRUST#ops-queue",
        actionLabel: t("alerts.actions.openQueue"),
      });
    }

    if (warnFlags.trustDisputesActive && typeof kpis.trustDisputesActive === "number") {
      alerts.push({
        id: "warn-trust-disputes",
        severity: "WARN",
        message: `${uiText.trustDisputesAlert}: ${kpis.trustDisputesActive}`,
        href: "/admin?opsFilter=TRUST#ops-queue",
        actionLabel: t("alerts.actions.openQueue"),
      });
    }

    if (reconData) {
      const confirmedLedgerMissingPayout = reconData.confirmedLedgerMissingPayout.length;
      const payoutReadyButActiveDispute = reconData.payoutReadyButActiveDispute.length;
      const orderPaidButLedgerNotConfirmed = reconData.orderPaidButLedgerNotConfirmed.length;

      if (confirmedLedgerMissingPayout > 0) {
        alerts.push({
          id: "critical-ledger-missing-payout",
          severity: "CRITICAL",
          message: t("alerts.items.criticalLedgerMissingPayout", {
            count: confirmedLedgerMissingPayout,
          }),
          href: "#ops-reconciliation",
          actionLabel: t("alerts.actions.openReconciliation"),
        });
      }

      if (payoutReadyButActiveDispute > 0) {
        alerts.push({
          id: "critical-payout-active-dispute",
          severity: "CRITICAL",
          message: t("alerts.items.criticalPayoutActiveDispute", {
            count: payoutReadyButActiveDispute,
          }),
          href: "#ops-reconciliation",
          actionLabel: t("alerts.actions.openReconciliation"),
        });
      }

      if (orderPaidButLedgerNotConfirmed > 0) {
        alerts.push({
          id: "critical-order-ledger-mismatch",
          severity: "CRITICAL",
          message: t("alerts.items.criticalOrderLedgerMismatch", {
            count: orderPaidButLedgerNotConfirmed,
          }),
          href: "#ops-reconciliation",
          actionLabel: t("alerts.actions.openReconciliation"),
        });
      }
    }

    if (notificationsHealth) {
      if (notificationsHealth.failedLast24h >= NOTIFICATION_ALERT_THRESHOLDS.FAILED_24H_CRITICAL) {
        alerts.push({
          id: "critical-notifications-failed",
          severity: "CRITICAL",
          message: `${uiText.notificationsFailed24h}: ${notificationsHealth.failedLast24h}`,
          href: "#ops-notifications-health",
          actionLabel: uiText.openNotificationsHealth,
        });
      } else if (notificationsHealth.failedLast24h >= NOTIFICATION_ALERT_THRESHOLDS.FAILED_24H_WARN) {
        alerts.push({
          id: "warn-notifications-failed",
          severity: "WARN",
          message: `${uiText.notificationsFailed24h}: ${notificationsHealth.failedLast24h}`,
          href: "#ops-notifications-health",
          actionLabel: uiText.openNotificationsHealth,
        });
      }

      const age = notificationsHealth.oldestPendingAgeSeconds;
      if (typeof age === "number" && age >= NOTIFICATION_ALERT_THRESHOLDS.OLDEST_PENDING_CRITICAL_SECONDS) {
        alerts.push({
          id: "critical-notifications-oldest-pending",
          severity: "CRITICAL",
          message: `${uiText.oldestPendingAge}: ${Math.floor(age / 60)}m`,
          href: "#ops-notifications-health",
          actionLabel: uiText.openNotificationsHealth,
        });
      } else if (typeof age === "number" && age >= NOTIFICATION_ALERT_THRESHOLDS.OLDEST_PENDING_WARN_SECONDS) {
        alerts.push({
          id: "warn-notifications-oldest-pending",
          severity: "WARN",
          message: `${uiText.oldestPendingAge}: ${Math.floor(age / 60)}m`,
          href: "#ops-notifications-health",
          actionLabel: uiText.openNotificationsHealth,
        });
      }

      const topFailure = notificationsHealth.topTemplateFailures[0];
      if (topFailure && topFailure.count >= NOTIFICATION_ALERT_THRESHOLDS.TOP_TEMPLATE_FAILURE_WARN) {
        alerts.push({
          id: "warn-notifications-template-failures",
          severity: "WARN",
          message: `${uiText.templateFailures}: ${topFailure.templateKey} (${topFailure.count})`,
          href: "#ops-notifications-health",
          actionLabel: uiText.openNotificationsHealth,
        });
      }
    }

    return alerts;
  }, [kpis, notificationsHealth, reconData, t, uiText, warnFlags]);

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

  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const queueSortedByAge = useMemo(() => {
    return [...filteredQueue].sort(
      (a, b) => ageLabelToMinutes(b.ageLabel) - ageLabelToMinutes(a.ageLabel)
    );
  }, [filteredQueue]);

  useEffect(() => {
    if (!focusItemId) return;
    const row = document.getElementById(`ops-row-${focusItemId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusItemId, activeFilter, queueSortedByAge.length]);

  const lastUpdatedLabel = useMemo(() => {
    const minutes = Math.max(0, Math.floor((clockTick - lastUpdatedAt) / 60000));
    if (minutes === 0) return isFr ? "A l'instant" : "Just now";
    if (minutes === 1) return isFr ? "Il y a 1 min" : "1m ago";
    return isFr ? `Il y a ${minutes} min` : `${minutes}m ago`;
  }, [clockTick, isFr, lastUpdatedAt]);

  const scrollToQueue = () => {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      document.getElementById("ops-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const applyFilter = (filter: QueueFilter) => {
    const query = filter === "ALL" ? {} : { opsFilter: filter };
    router.push({ pathname: "/admin", query }, { scroll: false });
    scrollToQueue();
  };

  const handleRefresh = () => {
    setLastUpdatedAt(Date.now());
    router.refresh();
  };

  const handleExportQueue = () => {
    if (typeof window === "undefined") return;

    const header = ["type", "reference", "priority", "status", "amount", "age"];
    const lines = queueSortedByAge.map((item) => {
      const status = statusOverrides[item.id] ?? item.status;
      const priority = getQueuePriority(item);
      const values = [
        typeLabels[item.type],
        item.refLabel,
        priority,
        statusLabels[status] ?? status,
        item.amountLabel ?? "-",
        item.ageLabel,
      ];
      return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ops-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <header className="sticky top-0 z-30 rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Ops Hub</h2>
            <p className="mt-1 text-sm text-zinc-300">{isFr ? "Supervision globale" : "Global supervision"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/50"
            >
              {isFr ? "Rafraichir" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handleExportQueue}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/50"
            >
              {isFr ? "Exporter" : "Export"}
            </button>
            <button
              type="button"
              onClick={() => void handleRunReconciliation()}
              disabled={reconLoading}
              className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reconLoading ? t("reconciliation.running") : `${t("reconciliation.title")} (dry-run)`}
            </button>
            {insights ? (
              <button
                type="button"
                onClick={() => setInsightsOpen(true)}
                className="rounded-full border border-sky-300/35 bg-sky-300/10 px-4 py-2 text-xs font-semibold text-sky-100 transition hover:border-sky-200/60"
              >
                {isFr ? "Insights" : "Insights"}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">{isFr ? "Derniere mise a jour" : "Last updated"}: {lastUpdatedLabel}</p>
      </header>

      <section id="ops-queue" className="rounded-2xl border border-white/10 bg-zinc-900/55 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{t("queue.title")}</h3>
              <p className="mt-1 text-xs text-zinc-400">{isFr ? "Priorise les actions critiques avant le reste du backlog." : "Prioritize critical actions before backlog work."}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => applyFilter(tab.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activeFilter === tab.key
                    ? "border-sky-300/60 bg-sky-300/20 text-sky-100"
                    : "border-white/20 text-white hover:border-white/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className={`${queueGridCols} border-b border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400`}>
              <span>{t("queue.columns.type")}</span>
              <span>{t("queue.columns.ref")}</span>
              <span>{isFr ? "Priorite" : "Priority"}</span>
              <span>{t("queue.columns.age")}</span>
              <span>{t("queue.columns.amount")}</span>
              <span>{t("queue.columns.status")}</span>
              <span className="text-right">{t("queue.columns.action")}</span>
            </div>

            <div className="divide-y divide-white/5">
              {queueSortedByAge.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-400">{t("queue.empty")}</div>
              ) : (
                queueSortedByAge.map((item) => {
                  const currentStatus = statusOverrides[item.id] ?? item.status;
                  const action = item.action;
                  const actionBusy = pendingRelease[item.id] === true;
                  const priority = getQueuePriority(item);
                  const isUrgent = priority === "URGENT";

                  const isFocused = focusItemId === item.id;

                  return (
                    <div
                      id={`ops-row-${item.id}`}
                      key={`${item.type}-${item.id}`}
                      className={`${queueGridCols} px-6 py-4 border-b border-white/10 transition ${isUrgent ? "border-l-4 border-l-red-500 bg-red-500/5 hover:bg-red-500/10" : "hover:bg-white/[0.02]"} ${isFocused ? "bg-cyan-300/10 ring-1 ring-cyan-300/40" : ""} last:border-b-0`}
                    >
                      <span className="text-sm font-medium text-sky-200">{typeLabels[item.type]}</span>
                      <span className="min-w-0 truncate text-sm text-zinc-200" title={item.refLabel}>{item.refLabel}</span>
                      <div className="flex justify-start">
                        <span
                          className={isUrgent
                            ? "inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400"
                            : "inline-flex items-center rounded-full border border-white/15 bg-zinc-950/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-100"}
                        >
                          {priority}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums text-zinc-300">{item.ageLabel}</span>
                      <span className="text-sm tabular-nums text-emerald-200">{item.amountLabel ?? "-"}</span>
                      <div>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-zinc-950/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100">
                          {statusLabels[currentStatus] ?? currentStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-3">
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
                        <p className="col-span-7 text-xs text-rose-300">{errorByItem[item.id]}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="ops-snapshot" className="rounded-2xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{isFr ? "Ops Snapshot" : "Ops Snapshot"}</h3>
            <p className="mt-1 text-xs text-zinc-400">{isFr ? "Vue rapide des filets de securite operationnels." : "Quick view of operational safeguards."}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                if (card.filter) {
                  applyFilter(card.filter);
                  return;
                }
                router.push(card.href as string);
              }}
              className={`cursor-pointer rounded-2xl border bg-zinc-950/60 p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/40 ${
                card.warn ? "border-amber-300/45" : "border-white/10"
              }`}
            >
              <p className="flex items-center gap-2 text-xs text-zinc-400">
                <span>{card.label}</span>
                {card.warn ? (
                  <span className="rounded-full border border-amber-300/50 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                    {t("alerts.labels.warn")}
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{typeof card.value === "number" ? card.value : "-"}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{isFr ? "Cliquer pour filtrer" : "Click to focus"}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
          <h3 className="text-lg font-semibold text-white">{t("alerts.title")}</h3>
          <p className="mt-1 text-xs text-zinc-400">{isFr ? "Alertes actives, priorisees par severite." : "Active alerts prioritized by severity."}</p>

          {activeAlerts.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">{t("alerts.none")}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        alert.severity === "CRITICAL"
                          ? "border-rose-300/50 bg-rose-300/15 text-rose-100"
                          : "border-amber-300/50 bg-amber-300/15 text-amber-100"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <p className="text-xs text-zinc-200">{alert.message}</p>
                  </div>
                  {alert.href && alert.actionLabel ? (
                    <Link
                      href={alert.href}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50"
                    >
                      {alert.actionLabel}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div id="ops-notifications-health" className="rounded-2xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{uiText.notificationsHealthTitle}</h3>
                <p className="mt-1 text-xs text-zinc-400">{uiText.notificationsHealthSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleLoadNotificationsHealth()}
                disabled={notificationsHealthLoading}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {notificationsHealthLoading
                  ? uiText.notificationsRefreshing
                  : notificationsHealth
                  ? uiText.notificationsRefresh
                  : uiText.notificationsLoad}
              </button>
            </div>

            {notificationsHealthError ? (
              <p className="mt-3 text-xs text-rose-300">{notificationsHealthError}</p>
            ) : null}

            {notificationsHealth ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                  <p className="text-zinc-500">{uiText.pendingLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{notificationsHealth.counts.PENDING}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                  <p className="text-zinc-500">{uiText.failed24hLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{notificationsHealth.failedLast24h}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                  <p className="text-zinc-500">{uiText.sent24hLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{notificationsHealth.sentLast24h}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                  <p className="text-zinc-500">{uiText.oldestPendingAgeLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {typeof notificationsHealth.oldestPendingAgeSeconds === "number"
                      ? `${Math.floor(notificationsHealth.oldestPendingAgeSeconds / 60)}m`
                      : "-"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-400">{uiText.loadNotificationHealthHint}</p>
            )}
          </div>

          <div id="ops-reconciliation" className="rounded-2xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{t("reconciliation.title")} (dry-run)</h3>
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
        </div>
      </section>

      {insights && insightsOpen ? (
        <div
          className="fixed inset-0 z-40 opacity-100 transition-opacity duration-200 motion-reduce:transition-none"
          onClick={() => setInsightsOpen(false)}
          aria-hidden={!insightsOpen}
        >
          <div className="absolute inset-0 pointer-events-auto bg-black/55 backdrop-blur-[1px]" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={isFr ? "Insights admin" : "Admin insights"}
            className="absolute right-0 top-0 flex h-full w-[92vw] max-w-[480px] flex-col overflow-hidden border-l border-white/10 bg-zinc-950/95 p-4 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none lg:w-[480px] translate-x-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{isFr ? "Insights" : "Insights"}</h3>
              <button
                type="button"
                onClick={() => setInsightsOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50"
              >
                {isFr ? "Fermer" : "Close"}
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-6 pr-1">
              <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{isFr ? "Produits les plus vendus" : "Top sold products"}</h4>
                    <p className="mt-1 text-[11px] text-zinc-400">{isFr ? "Top 5 ventes payees" : "Top 5 paid sales"}</p>
                  </div>
                  <Link
                    href={insights.productsHref}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-white/50"
                  >
                    {isFr ? "Voir tout" : "View all"}
                  </Link>
                </div>
                {insights.products.length === 0 ? (
                  <p className="text-xs text-zinc-400">{isFr ? "Aucune donnee." : "No data."}</p>
                ) : (
                  <div className="space-y-2">
                    {insights.products.map((item) => (
                      <article key={item.id} className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                            <p className="truncate text-[11px] text-zinc-500">{item.sellerName}</p>
                          </div>
                          <p className="text-xs text-emerald-200">{isFr ? `${item.units} unites` : `${item.units} units`}</p>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                          <div className="h-1.5 rounded-full bg-emerald-400 transition-all duration-300 motion-reduce:transition-none" style={{ width: `${item.barPercent}%` }} />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{isFr ? "Top vendeurs" : "Top sellers"}</h4>
                    <p className="mt-1 text-[11px] text-zinc-400">{isFr ? "Classement revenu (30j)" : "Revenue ranking (30d)"}</p>
                  </div>
                  <Link
                    href={insights.sellersHref}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-white/50"
                  >
                    {isFr ? "Voir tout" : "View all"}
                  </Link>
                </div>
                {insights.sellers.length === 0 ? (
                  <p className="text-xs text-zinc-400">{isFr ? "Aucune donnee." : "No data."}</p>
                ) : (
                  <div className="space-y-2">
                    {insights.sellers.map((item) => (
                      <article key={item.id} className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">{item.name}</p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {isFr ? `${item.orders} commandes` : `${item.orders} orders`}
                            </p>
                          </div>
                          <p className="text-xs text-sky-200">{item.revenueLabel}</p>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                          <div className="h-1.5 rounded-full bg-sky-400 transition-all duration-300 motion-reduce:transition-none" style={{ width: `${item.barPercent}%` }} />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
