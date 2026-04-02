"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Submission = {
  id: string;
  targetRole: string;
  status: string;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  reviewedBy?: {
    id: string;
    name?: string | null;
    email: string;
  } | null;
  docIdUrl?: string | null;
  driverLicenseUrl?: string | null;
  proofAddressUrl?: string | null;
  selfieUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    isActive: boolean;
  };
};

export default function AdminKycBoard() {
  const t = useTranslations("AdminKyc");
  const locale = useLocale();
  const isFr = locale === "fr";
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, [statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateUser = async (id: string, payload: { role?: string; isActive?: boolean }) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      let reviewReason: string | undefined;
      if (status === "REJECTED") {
        const reason = window.prompt(
          isFr
            ? "Raison du refus (optionnel, recommande)"
            : "Rejection reason (optional, recommended)"
        );
        reviewReason = reason?.trim() || undefined;
      }

      const res = await fetch(`/api/admin/kyc/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewReason }),
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

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { key: "docIdUrl", label: t("labels.docId"), url: submission.docIdUrl },
                  { key: "driverLicenseUrl", label: t("labels.driver"), url: submission.driverLicenseUrl },
                  { key: "proofAddressUrl", label: t("labels.proof"), url: submission.proofAddressUrl },
                  { key: "selfieUrl", label: t("labels.selfie"), url: submission.selfieUrl },
                ].map((doc) => (
                  <div key={doc.key} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
                    <p className="text-[11px] text-zinc-400">{doc.label}</p>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block overflow-hidden rounded-xl border border-white/10"
                      >
                        <img src={doc.url} alt={doc.label} className="h-32 w-full object-cover" />
                      </a>
                    ) : (
                      <p className="mt-2 text-[11px] text-zinc-500">{t("labels.missing")}</p>
                    )}
                  </div>
                ))}
                {submission.notes && (
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 sm:col-span-2">
                    <p className="text-[11px] text-zinc-400">{t("labels.notes")}</p>
                    <p className="mt-2 text-xs text-zinc-200">{submission.notes}</p>
                  </div>
                )}
                {(submission.reviewedAt || submission.reviewReason) && (
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 sm:col-span-2">
                    {submission.reviewedAt ? (
                      <p className="text-[11px] text-zinc-400">
                        Review: {new Date(submission.reviewedAt).toLocaleString(isFr ? "fr-FR" : "en-US")}
                        {submission.reviewedBy
                          ? ` - ${submission.reviewedBy.name || submission.reviewedBy.email}`
                          : ""}
                      </p>
                    ) : null}
                    {submission.reviewReason ? (
                      <p className="mt-2 text-xs text-zinc-200">Reason: {submission.reviewReason}</p>
                    ) : null}
                  </div>
                )}
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
                {submission.status === "APPROVED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateUser(submission.user.id, { role: "CUSTOMER" })}
                      className="rounded-full border border-white/20 px-4 py-2 text-[11px] font-semibold text-white"
                    >
                      {t("actions.removeRole")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateUser(submission.user.id, { isActive: !submission.user.isActive })
                      }
                      className="rounded-full border border-white/20 px-4 py-2 text-[11px] font-semibold text-white"
                    >
                      {submission.user.isActive
                        ? t("actions.block")
                        : t("actions.unblock")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
