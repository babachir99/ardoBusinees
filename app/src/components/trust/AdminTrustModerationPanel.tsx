"use client";

import { useEffect, useMemo, useState } from "react";

type TrustReportItem = {
  id: string;
  reporterId: string;
  reportedId: string;
  reporter?: { id: string; name: string | null };
  reported?: { id: string; name: string | null };
  assignedAdminId: string | null;
  assignedAdmin?: { id: string; name: string | null };
  reason: string;
  description: string | null;
  proofUrls: string[];
  status: "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionCode: string | null;
  internalNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TrustDisputeItem = {
  id: string;
  userId: string;
  user?: { id: string; name: string | null };
  assignedAdminId: string | null;
  assignedAdmin?: { id: string; name: string | null };
  orderId: string | null;
  vertical: "SHOP" | "PRESTA" | "GP" | "TIAK" | "IMMO" | "CARS";
  reason: string;
  description: string;
  proofUrls: string[];
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionCode: string | null;
  internalNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  locale: string;
  currentAdminId: string;
  initialReports: TrustReportItem[];
  initialDisputes: TrustDisputeItem[];
  initialTab?: "reports" | "disputes";
  focusId?: string | null;
};

export default function AdminTrustModerationPanel({
  locale,
  currentAdminId,
  initialReports,
  initialDisputes,
  initialTab = "reports",
  focusId = null,
}: Props) {
  const isFr = locale === "fr";
  const [tab, setTab] = useState<"reports" | "disputes">(initialTab);
  const [reports, setReports] = useState(initialReports);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportStatusFilter, setReportStatusFilter] = useState<"ALL" | TrustReportItem["status"]>("ALL");
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<"ALL" | TrustDisputeItem["status"]>("ALL");
  const [verticalFilter, setVerticalFilter] = useState<"ALL" | TrustDisputeItem["vertical"]>("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("ALL");
  const [reportNoteDrafts, setReportNoteDrafts] = useState<Record<string, string>>({});
  const [reportCodeDrafts, setReportCodeDrafts] = useState<Record<string, string>>({});
  const [disputeNoteDrafts, setDisputeNoteDrafts] = useState<Record<string, string>>({});
  const [disputeCodeDrafts, setDisputeCodeDrafts] = useState<Record<string, string>>({});

  const reportStatuses = ["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;
  const disputeStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;

  useEffect(() => {
    const nextReportNotes: Record<string, string> = {};
    const nextReportCodes: Record<string, string> = {};
    for (const item of initialReports) {
      nextReportNotes[item.id] = item.internalNote ?? "";
      nextReportCodes[item.id] = item.resolutionCode ?? "";
    }
    setReportNoteDrafts(nextReportNotes);
    setReportCodeDrafts(nextReportCodes);

    const nextDisputeNotes: Record<string, string> = {};
    const nextDisputeCodes: Record<string, string> = {};
    for (const item of initialDisputes) {
      nextDisputeNotes[item.id] = item.internalNote ?? "";
      nextDisputeCodes[item.id] = item.resolutionCode ?? "";
    }
    setDisputeNoteDrafts(nextDisputeNotes);
    setDisputeCodeDrafts(nextDisputeCodes);
  }, [initialReports, initialDisputes]);

  async function patchRecord(kind: "reports" | "disputes", id: string, patch: Record<string, unknown>) {
    const key = `${kind}:${id}:${JSON.stringify(patch)}`;
    setBusyKey(key);
    setNotice(null);
    setError(null);

    try {
      const res = await fetch(`/api/trust/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.code || "Request failed");

      if (kind === "reports") {
        setReports((cur) => cur.map((item) => (item.id === id ? data.report : item)));
        if (data?.report) {
          setReportNoteDrafts((cur) => ({ ...cur, [id]: data.report.internalNote ?? "" }));
          setReportCodeDrafts((cur) => ({ ...cur, [id]: data.report.resolutionCode ?? "" }));
        }
      } else {
        setDisputes((cur) => cur.map((item) => (item.id === id ? data.dispute : item)));
        if (data?.dispute) {
          setDisputeNoteDrafts((cur) => ({ ...cur, [id]: data.dispute.internalNote ?? "" }));
          setDisputeCodeDrafts((cur) => ({ ...cur, [id]: data.dispute.resolutionCode ?? "" }));
        }
      }

      setNotice(isFr ? "Mise a jour enregistree." : "Update saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : isFr ? "Erreur serveur." : "Server error.");
    } finally {
      setBusyKey(null);
    }
  }

  const filteredReports = useMemo(() => {
    const now = Date.now();
    return reports.filter((item) => {
      if (reportStatusFilter !== "ALL" && item.status !== reportStatusFilter) return false;
      if (dateFilter !== "ALL") {
        const maxAgeMs = dateFilter === "7D" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        if (now - new Date(item.createdAt).getTime() > maxAgeMs) return false;
      }
      return true;
    });
  }, [reports, reportStatusFilter, dateFilter]);

  const filteredDisputes = useMemo(() => {
    const now = Date.now();
    return disputes.filter((item) => {
      if (disputeStatusFilter !== "ALL" && item.status !== disputeStatusFilter) return false;
      if (verticalFilter !== "ALL" && item.vertical !== verticalFilter) return false;
      if (dateFilter !== "ALL") {
        const maxAgeMs = dateFilter === "7D" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        if (now - new Date(item.createdAt).getTime() > maxAgeMs) return false;
      }
      return true;
    });
  }, [disputes, disputeStatusFilter, verticalFilter, dateFilter]);

  const counts = useMemo(
    () => ({ reports: filteredReports.length, disputes: filteredDisputes.length }),
    [filteredReports.length, filteredDisputes.length]
  );

  useEffect(() => {
    if (!focusId) return;
    const row = document.getElementById(`trust-row-${focusId}`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, tab, reports, disputes]);

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{isFr ? "Moderation Trust" : "Trust moderation"}</h2>
          <p className="text-sm text-zinc-400">{isFr ? "Signalements + plaintes (V0.2 workflow)" : "Reports + disputes (V0.2 workflow)"}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setTab("reports")} className={`rounded-full px-4 py-2 font-semibold ${tab === "reports" ? "bg-white text-zinc-950" : "border border-white/15 text-zinc-200"}`}>{isFr ? `Signalements (${counts.reports})` : `Reports (${counts.reports})`}</button>
          <button type="button" onClick={() => setTab("disputes")} className={`rounded-full px-4 py-2 font-semibold ${tab === "disputes" ? "bg-white text-zinc-950" : "border border-white/15 text-zinc-200"}`}>{isFr ? `Plaintes (${counts.disputes})` : `Disputes (${counts.disputes})`}</button>
        </div>
      </div>

      {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2 text-zinc-300">
          <span>{isFr ? "Periode" : "Window"}</span>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
            <option value="ALL">{isFr ? "Toutes" : "All"}</option>
            <option value="7D">7d</option>
            <option value="30D">30d</option>
          </select>
        </label>
        {tab === "reports" ? (
          <label className="flex items-center gap-2 text-zinc-300">
            <span>{isFr ? "Statut" : "Status"}</span>
            <select value={reportStatusFilter} onChange={(e) => setReportStatusFilter(e.target.value as "ALL" | TrustReportItem["status"])} className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
              <option value="ALL">ALL</option>
              {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="flex items-center gap-2 text-zinc-300">
              <span>{isFr ? "Statut" : "Status"}</span>
              <select value={disputeStatusFilter} onChange={(e) => setDisputeStatusFilter(e.target.value as "ALL" | TrustDisputeItem["status"])} className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                <option value="ALL">ALL</option>
                {disputeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <span>Vertical</span>
              <select value={verticalFilter} onChange={(e) => setVerticalFilter(e.target.value as "ALL" | TrustDisputeItem["vertical"])} className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                <option value="ALL">ALL</option>
                <option value="SHOP">SHOP</option>
                <option value="PRESTA">PRESTA</option>
                <option value="GP">GP</option>
                <option value="TIAK">TIAK</option>
                <option value="IMMO">IMMO</option>
                <option value="CARS">CARS</option>
              </select>
            </label>
          </>
        )}
      </div>

      {tab === "reports" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Reporter</th><th className="px-2 py-2">Reported</th><th className="px-2 py-2">Assignee</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {filteredReports.map((item) => (
                <tr key={item.id} id={`trust-row-${item.id}`} className={`border-t border-white/5 align-top ${focusId === item.id ? "bg-cyan-300/5" : ""}`}>
                  <td className="px-2 py-3 text-zinc-300">{new Date(item.createdAt).toLocaleString(locale)}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.reporter?.name ?? item.reporterId}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.reported?.name ?? item.reportedId}</td>
                  <td className="px-2 py-3 text-zinc-300">{item.assignedAdmin?.name ?? item.assignedAdminId ?? "-"}</td>
                  <td className="px-2 py-3 text-zinc-200">
                    <div>{item.reason}</div>
                    <details open={focusId === item.id} className="mt-1 text-xs text-zinc-400">
                      <summary className="cursor-pointer">{isFr ? "Details" : "Details"}</summary>
                      <p className="mt-1 whitespace-pre-wrap">{item.description ?? "-"}</p>
                      {item.proofUrls.length > 0 && (
                        <div className="mt-2 grid gap-1">
                          <p className="text-[11px] text-zinc-500">{isFr ? "Preuves" : "Evidence"}</p>
                          {item.proofUrls.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="truncate text-[11px] text-cyan-300 hover:text-cyan-200">
                              {url}
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 grid gap-2">
                        <input
                          value={reportCodeDrafts[item.id] ?? ""}
                          onChange={(event) => setReportCodeDrafts((cur) => ({ ...cur, [item.id]: event.target.value }))}
                          className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                          placeholder={isFr ? "Code resolution" : "Resolution code"}
                        />
                        <textarea
                          value={reportNoteDrafts[item.id] ?? ""}
                          onChange={(event) => setReportNoteDrafts((cur) => ({ ...cur, [item.id]: event.target.value }))}
                          className="min-h-16 rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                          placeholder={isFr ? "Note interne" : "Internal note"}
                        />
                        <p>{isFr ? "Revise le" : "Reviewed at"}: {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString(locale) : "-"}</p>
                      </div>
                    </details>
                  </td>
                  <td className="px-2 py-3 text-zinc-300">{item.status}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {reportStatuses.map((status) => <button key={status} type="button" onClick={() => patchRecord("reports", item.id, { status })} disabled={busyKey === `reports:${item.id}:${JSON.stringify({ status })}` || item.status === status} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200 disabled:opacity-40">{status}</button>)}
                      <button type="button" onClick={() => patchRecord("reports", item.id, { assignedAdminId: currentAdminId })} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">{isFr ? "Assigner moi" : "Assign me"}</button>
                      <button type="button" onClick={() => patchRecord("reports", item.id, { assignedAdminId: "" })} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">{isFr ? "Retirer" : "Unassign"}</button>
                      <button type="button" onClick={() => patchRecord("reports", item.id, { resolutionCode: reportCodeDrafts[item.id] ?? "", internalNote: reportNoteDrafts[item.id] ?? "" })} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">{isFr ? "Sauver note" : "Save note"}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 ? <tr><td className="px-2 py-6 text-zinc-500" colSpan={7}>{isFr ? "Aucun signalement." : "No reports."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">User</th><th className="px-2 py-2">Assignee</th><th className="px-2 py-2">Vertical</th><th className="px-2 py-2">Ref</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {filteredDisputes.map((item) => (
                <tr key={item.id} id={`trust-row-${item.id}`} className={`border-t border-white/5 align-top ${focusId === item.id ? "bg-cyan-300/5" : ""}`}>
                  <td className="px-2 py-3 text-zinc-300">{new Date(item.createdAt).toLocaleString(locale)}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.user?.name ?? item.userId}</td>
                  <td className="px-2 py-3 text-zinc-300">{item.assignedAdmin?.name ?? item.assignedAdminId ?? "-"}</td>
                  <td className="px-2 py-3 text-zinc-200">{item.vertical}</td>
                  <td className="px-2 py-3 text-zinc-300">{item.orderId ?? "-"}</td>
                  <td className="px-2 py-3 text-zinc-200">
                    <div>{item.reason}</div>
                    <details open={focusId === item.id} className="mt-1 text-xs text-zinc-400">
                      <summary className="cursor-pointer">{isFr ? "Details" : "Details"}</summary>
                      <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
                      {item.proofUrls.length > 0 && (
                        <div className="mt-2 grid gap-1">
                          <p className="text-[11px] text-zinc-500">{isFr ? "Preuves" : "Evidence"}</p>
                          {item.proofUrls.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="truncate text-[11px] text-cyan-300 hover:text-cyan-200">
                              {url}
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 grid gap-2">
                        <input
                          value={disputeCodeDrafts[item.id] ?? ""}
                          onChange={(event) => setDisputeCodeDrafts((cur) => ({ ...cur, [item.id]: event.target.value }))}
                          className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                          placeholder={isFr ? "Code resolution" : "Resolution code"}
                        />
                        <textarea
                          value={disputeNoteDrafts[item.id] ?? ""}
                          onChange={(event) => setDisputeNoteDrafts((cur) => ({ ...cur, [item.id]: event.target.value }))}
                          className="min-h-16 rounded-lg border border-white/15 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                          placeholder={isFr ? "Note interne" : "Internal note"}
                        />
                        <p>{isFr ? "Revise le" : "Reviewed at"}: {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString(locale) : "-"}</p>
                      </div>
                    </details>
                  </td>
                  <td className="px-2 py-3 text-zinc-300">{item.status}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {disputeStatuses.map((status) => <button key={status} type="button" onClick={() => patchRecord("disputes", item.id, { status })} disabled={busyKey === `disputes:${item.id}:${JSON.stringify({ status })}` || item.status === status} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200 disabled:opacity-40">{status}</button>)}
                      <button type="button" onClick={() => patchRecord("disputes", item.id, { assignedAdminId: currentAdminId })} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">{isFr ? "Assigner moi" : "Assign me"}</button>
                      <button type="button" onClick={() => patchRecord("disputes", item.id, { assignedAdminId: "" })} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">{isFr ? "Retirer" : "Unassign"}</button>
                      <button type="button" onClick={() => patchRecord("disputes", item.id, { resolutionCode: disputeCodeDrafts[item.id] ?? "", internalNote: disputeNoteDrafts[item.id] ?? "" })} className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-200">{isFr ? "Sauver note" : "Save note"}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDisputes.length === 0 ? <tr><td className="px-2 py-6 text-zinc-500" colSpan={8}>{isFr ? "Aucune plainte." : "No disputes."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
