"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Submission = {
  id: string;
  targetRole: string;
  status: string;
  docIdUrl?: string | null;
  driverLicenseUrl?: string | null;
  proofAddressUrl?: string | null;
  selfieUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  user: { id: string; email: string; name?: string | null; role: string };
};

export default function AdminKycBoard() {
  const t = useTranslations("AdminKyc");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/kyc?${params.toString()}`);
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Submission[];
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/admin/kyc/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
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
        <select
          className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-xs text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("filters.all")}</option>
          <option value="PENDING">{t("filters.pending")}</option>
          <option value="APPROVED">{t("filters.approved")}</option>
          <option value="REJECTED">{t("filters.rejected")}</option>
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

      {submissions.length > 0 && (
        <div className="mt-6 grid gap-4">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5 text-xs text-zinc-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">{t("labels.user")}</p>
                  <p className="text-sm font-semibold text-white">
                    {submission.user.name || t("labels.noName")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {submission.user.email}
                  </p>
                </div>
                <div className="text-right">
                  <p>{t("labels.role")} {submission.targetRole}</p>
                  <p>{t("labels.status")} {submission.status}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs">
                <p>{t("labels.docId")}: {submission.docIdUrl || "-"}</p>
                <p>{t("labels.driver")}: {submission.driverLicenseUrl || "-"}</p>
                <p>{t("labels.proof")}: {submission.proofAddressUrl || "-"}</p>
                <p>{t("labels.selfie")}: {submission.selfieUrl || "-"}</p>
                {submission.notes && <p>{t("labels.notes")}: {submission.notes}</p>}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => updateStatus(submission.id, "APPROVED")}
                  className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                >
                  {t("actions.approve")}
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(submission.id, "REJECTED")}
                  className="rounded-full border border-white/20 px-4 py-2 text-[11px] font-semibold text-white"
                >
                  {t("actions.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
