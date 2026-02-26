"use client";

import { useMemo, useState } from "react";

type TrustReportItem = {
  id: string;
  reporterId: string;
  reportedId: string;
  reporter?: { id: string; name: string | null };
  reported?: { id: string; name: string | null };
  reason: string;
  description: string | null;
  status: "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
};

type TrustDisputeItem = {
  id: string;
  userId: string;
  user?: { id: string; name: string | null };
  orderId: string | null;
  vertical: "SHOP" | "PRESTA" | "GP" | "TIAK" | "IMMO" | "CARS";
  reason: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
};

export default function AdminTrustModerationPanel({ locale, initialReports, initialDisputes }: { locale: string; initialReports: TrustReportItem[]; initialDisputes: TrustDisputeItem[]; }) {
  const isFr = locale === "fr";
  const [tab, setTab] = useState<"reports" | "disputes">("reports");
  const [reports, setReports] = useState(initialReports);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reportStatuses = ["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;
  const disputeStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;

  async function patchRecord(kind: "reports" | "disputes", id: string, status: string) {
    const key = `${kind}:${id}:${status}`;
    setBusyKey(key);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/trust/${kind}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.code || "Request failed");
      if (kind === "reports") {
        setReports((cur) => cur.map((item) => (item.id === id ? data.report : item)));
      } else {
        setDisputes((cur) => cur.map((item) => (item.id === id ? data.dispute : item)));
      }
      setNotice(isFr ? "Statut mis a jour." : "Status updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : (isFr ? "Erreur serveur." : "Server error."));
    } finally {
      setBusyKey(null);
    }
  }

  const counts = useMemo(() => ({ reports: reports.length, disputes: disputes.length }), [reports.length, disputes.length]);

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{isFr ? "Moderation Trust" : "Trust moderation"}</h2>
          <p className="text-sm text-zinc-400">{isFr ? "Signalements + plaintes (V0.1)" : "Reports + disputes (V0.1)"}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setTab("reports")} className={`rounded-full px-4 py-2 font-semibold ${tab === "reports" ? "bg-white text-zinc-950" : "border border-white/15 text-zinc-200"}`}>{isFr ? `Signalements (${counts.reports})` : `Reports (${counts.reports})`}</button>
          <button type="button" onClick={() => setTab("disputes")} className={`rounded-full px-4 py-2 font-semibold ${tab === "disputes" ? "bg-white text-zinc-950" : "border border-white/15 text-zinc-200"}`}>{isFr ? `Plaintes (${counts.disputes})` : `Disputes (${counts.disputes})`}</button>
        </div>
      </div>
      {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {tab === "reports" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Reporter</th><th className="px-2 py-2">Reported</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {reports.map((item) => (
                <tr key={item.id} className="border-t border-white/5 align-top">
                  <td className="px-2 py-3 text-zinc-300">{new Date(item.createdAt).toLocaleString(locale)}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.reporter?.name ?? item.reporterId}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.reported?.name ?? item.reportedId}</td>
                  <td className="px-2 py-3 text-zinc-200"><div>{item.reason}</div><details className="mt-1 text-xs text-zinc-400"><summary className="cursor-pointer">{isFr ? "Details" : "Details"}</summary><p className="mt-1 whitespace-pre-wrap">{item.description ?? "-"}</p></details></td>
                  <td className="px-2 py-3 text-zinc-300">{item.status}</td>
                  <td className="px-2 py-3"><div className="flex flex-wrap gap-2">{reportStatuses.map((status) => <button key={status} type="button" onClick={() => patchRecord("reports", item.id, status)} disabled={busyKey === `reports:${item.id}:${status}` || item.status === status} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200 disabled:opacity-40">{status}</button>)}</div></td>
                </tr>
              ))}
              {reports.length === 0 ? <tr><td className="px-2 py-6 text-zinc-500" colSpan={6}>{isFr ? "Aucun signalement." : "No reports."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">User</th><th className="px-2 py-2">Vertical</th><th className="px-2 py-2">Ref</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {disputes.map((item) => (
                <tr key={item.id} className="border-t border-white/5 align-top">
                  <td className="px-2 py-3 text-zinc-300">{new Date(item.createdAt).toLocaleString(locale)}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.user?.name ?? item.userId}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.vertical}</td>
                  <td className="px-2 py-3 text-zinc-300">{item.orderId ?? "-"}</td>
                  <td className="px-2 py-3 text-zinc-200"><div>{item.reason}</div><details className="mt-1 text-xs text-zinc-400"><summary className="cursor-pointer">{isFr ? "Details" : "Details"}</summary><p className="mt-1 whitespace-pre-wrap">{item.description}</p></details></td>
                  <td className="px-2 py-3 text-zinc-300">{item.status}</td>
                  <td className="px-2 py-3"><div className="flex flex-wrap gap-2">{disputeStatuses.map((status) => <button key={status} type="button" onClick={() => patchRecord("disputes", item.id, status)} disabled={busyKey === `disputes:${item.id}:${status}` || item.status === status} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200 disabled:opacity-40">{status}</button>)}</div></td>
                </tr>
              ))}
              {disputes.length === 0 ? <tr><td className="px-2 py-6 text-zinc-500" colSpan={7}>{isFr ? "Aucune plainte." : "No disputes."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
