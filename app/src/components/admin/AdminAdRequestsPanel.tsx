"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { AdRequestEntry } from "@/lib/adRequests.shared";
import { getPlacementLabel } from "@/components/admin/homePromoAdminShared";

type Props = {
  locale: string;
  initialRequests: AdRequestEntry[];
};

function getStatusMeta(locale: string, status: AdRequestEntry["status"]) {
  const isFr = locale === "fr";

  switch (status) {
    case "APPROVED":
      return {
        label: isFr ? "Validee" : "Approved",
        className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
      };
    case "REJECTED":
      return {
        label: isFr ? "Refusee" : "Rejected",
        className: "border-rose-300/25 bg-rose-400/10 text-rose-100",
      };
    default:
      return {
        label: isFr ? "En attente" : "Pending",
        className: "border-amber-300/25 bg-amber-400/10 text-amber-100",
      };
  }
}

function getVerticalLabel(locale: string, sourceVertical: string) {
  const normalized = sourceVertical.trim().toUpperCase();
  const labels: Record<string, string> = {
    PRESTA: "PRESTA",
    TIAK: "TIAK",
    GP: "GP",
    CARS: "CARS",
    IMMO: "IMMO",
    CARES: "CARES",
  };

  return labels[normalized] ?? (locale === "fr" ? "Verticale" : "Vertical");
}

function getBillingStatusLabel(locale: string, billingStatus: AdRequestEntry["billingStatus"]) {
  const isFr = locale === "fr";

  switch (billingStatus) {
    case "QUOTE_PENDING":
      return isFr ? "Devis en attente" : "Quote pending";
    case "PAYMENT_PENDING":
      return isFr ? "Paiement en attente" : "Payment pending";
    case "PAID":
      return isFr ? "Paye" : "Paid";
    case "READY":
      return isFr ? "Pret" : "Ready";
    default:
      return billingStatus;
  }
}

export default function AdminAdRequestsPanel({ locale, initialRequests }: Props) {
  const isFr = locale === "fr";
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState(initialRequests[0]?.id ?? null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedRequest = useMemo(
    () => requests.find((entry) => entry.id === selectedId) ?? requests[0] ?? null,
    [requests, selectedId]
  );

  async function review(status: "APPROVED" | "REJECTED") {
    if (!selectedRequest) return;

    setSubmitting(status);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/ad-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });

      if (!response.ok) {
        throw new Error("REVIEW_FAILED");
      }

      const data = (await response.json()) as { request?: AdRequestEntry };
      if (!data.request) {
        throw new Error("REVIEW_FAILED");
      }

      setRequests((current) =>
        current.map((entry) => (entry.id === data.request!.id ? data.request! : entry))
      );
      setAdminNote(data.request.adminNote ?? "");
      setFeedback(
        status === "APPROVED"
          ? isFr
            ? "Demande validee. Un brouillon de campagne a ete prepare."
            : "Request approved. A draft campaign has been prepared."
          : isFr
            ? "Demande refusee."
            : "Request rejected."
      );
    } catch {
      setFeedback(
        isFr
          ? "Impossible de mettre a jour cette demande."
          : "We could not update this request."
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/55 p-5 shadow-[0_16px_44px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
            {isFr ? "Demandes externes" : "External requests"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {isFr ? "Demandes de pub" : "Ad requests"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-300">
            {isFr
              ? "Les marques ou sites externes peuvent demander une visibilite sur les differentes verticales JONTAADO. Ici, on relit, on valide ou on refuse, puis on prepare un brouillon de campagne."
              : "External brands or sites can request visibility across JONTAADO verticals. Review, approve or reject them here, then prepare a campaign draft."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
          <span className="font-semibold text-white">{requests.length}</span>
          {isFr ? "demande(s)" : "request(s)"}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-zinc-950/35 px-4 py-5 text-sm text-zinc-400">
          {isFr
            ? "Aucune demande de pub pour l'instant."
            : "No ad requests yet."}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-3">
            {requests.map((request) => {
              const statusMeta = getStatusMeta(locale, request.status);
              const isSelected = request.id === selectedRequest?.id;

              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(request.id);
                    setAdminNote(request.adminNote ?? "");
                    setFeedback(null);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-emerald-300/35 bg-emerald-400/10 shadow-[0_20px_40px_-32px_rgba(16,185,129,0.4)]"
                      : "border-white/10 bg-zinc-950/40 hover:border-white/20 hover:bg-zinc-950/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{request.companyName}</p>
                      <p className="mt-1 truncate text-xs text-zinc-400">{request.campaignTitle}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-emerald-100">
                      {getVerticalLabel(locale, request.sourceVertical)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {getPlacementLabel(locale, request.desiredPlacement)}
                    </span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                      {getBillingStatusLabel(locale, request.billingStatus)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {request.contactName}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRequest ? (
            <div className="rounded-[1.8rem] border border-white/10 bg-zinc-950/45 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    {selectedRequest.companyName}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    {selectedRequest.campaignTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {selectedRequest.campaignDescription}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={selectedRequest.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 transition hover:border-white/20 hover:bg-white/10"
                  >
                    {isFr ? "Voir le site" : "Visit site"}
                  </a>
                  {selectedRequest.approvedCampaignId ? (
                    <Link
                      href="/admin/campaigns"
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-400/15"
                    >
                      {isFr ? "Voir les campagnes" : "Open campaigns"}
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {isFr ? "Contact" : "Contact"}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-zinc-200">
                    <p>{selectedRequest.contactName}</p>
                    <p>{selectedRequest.email}</p>
                    {selectedRequest.phone ? <p>{selectedRequest.phone}</p> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {isFr ? "Format demande" : "Requested format"}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-zinc-200">
                    <p>
                      {isFr ? "Verticale" : "Vertical"}: {getVerticalLabel(locale, selectedRequest.sourceVertical)}
                    </p>
                    <p>{getPlacementLabel(locale, selectedRequest.desiredPlacement)}</p>
                    <p>
                      {isFr ? "Etat commercial" : "Commercial status"}:{" "}
                      {getBillingStatusLabel(locale, selectedRequest.billingStatus)}
                    </p>
                    <p>
                      {isFr ? "Budget" : "Budget"}: {selectedRequest.budget ?? (isFr ? "Non precise" : "Not specified")}
                    </p>
                    <p>
                      {isFr ? "CTA" : "CTA"}: {selectedRequest.ctaLabel}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRequest.logoUrl || selectedRequest.imageUrl ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {selectedRequest.logoUrl ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {isFr ? "Logo fourni" : "Provided logo"}
                      </p>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedRequest.logoUrl}
                          alt={isFr ? "Logo annonceur" : "Advertiser logo"}
                          className="h-20 w-full object-contain"
                        />
                      </div>
                    </div>
                  ) : null}

                  {selectedRequest.imageUrl ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {isFr ? "Visuel fourni" : "Provided visual"}
                      </p>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedRequest.imageUrl}
                          alt={isFr ? "Visuel annonceur" : "Advertiser visual"}
                          className="h-28 w-full rounded-xl object-cover"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selectedRequest.notes ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {isFr ? "Notes annonceur" : "Advertiser notes"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{selectedRequest.notes}</p>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="flex flex-col gap-2 text-xs text-zinc-300">
                  {isFr ? "Note admin" : "Admin note"}
                  <textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    className="min-h-[92px] rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/15"
                    placeholder={
                      isFr
                        ? "Ex: OK pour un brouillon HOME_INLINE, budget a clarifier."
                        : "Ex: OK for a HOME_INLINE draft, budget to clarify."
                    }
                  />
                </label>
              </div>

              {feedback ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                  {feedback}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-500">
                  {isFr ? "Recue le" : "Received"}{" "}
                  {new Date(selectedRequest.createdAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => review("REJECTED")}
                    disabled={submitting !== null}
                    className="rounded-full border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:border-rose-300/35 hover:bg-rose-400/15 disabled:opacity-60"
                  >
                    {submitting === "REJECTED"
                      ? isFr
                        ? "Refus..."
                        : "Rejecting..."
                      : isFr
                        ? "Refuser"
                        : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={() => review("APPROVED")}
                    disabled={submitting !== null}
                    className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {submitting === "APPROVED"
                      ? isFr
                        ? "Validation..."
                        : "Approving..."
                      : isFr
                        ? "Valider + brouillon"
                        : "Approve + draft"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
