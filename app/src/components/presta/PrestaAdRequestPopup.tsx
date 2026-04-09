"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  locale: string;
  onClose: () => void;
  sourceVertical?: string;
};

type PlacementOption = {
  value: "HOME_POPUP" | "HOME_INLINE" | "HOME_PRODUCT_CARD" | "STORE_INLINE";
  label: string;
  hint: string;
};

const initialState = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  websiteUrl: "",
  campaignTitle: "",
  campaignDescription: "",
  ctaLabel: "",
  desiredPlacement: "STORE_INLINE" as PlacementOption["value"],
  logoUrl: "",
  imageUrl: "",
  budget: "",
  notes: "",
};

function getVerticalLabel(locale: string, sourceVertical: string) {
  const isFr = locale === "fr";
  const key = sourceVertical.toUpperCase();
  if (key === "PRESTA") return "PRESTA";
  if (key === "TIAK") return "TIAK";
  if (key === "GP") return "GP";
  if (key === "CARS") return "CARS";
  if (key === "IMMO") return "IMMO";
  if (key === "CARES") return "CARES";
  return isFr ? "la verticale" : "the vertical";
}

export default function PrestaAdRequestPopup({
  open,
  locale,
  onClose,
  sourceVertical = "PRESTA",
}: Props) {
  const isFr = locale === "fr";
  const verticalLabel = getVerticalLabel(locale, sourceVertical);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<"logoUrl" | "imageUrl" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const placements = useMemo<PlacementOption[]>(
    () => [
      {
        value: "STORE_INLINE",
        label: isFr ? `Bandeau ${verticalLabel}` : `${verticalLabel} banner`,
        hint: isFr ? `Sous le hero ${verticalLabel}` : `Below the ${verticalLabel} hero`,
      },
      {
        value: "HOME_INLINE",
        label: isFr ? "Bandeau accueil" : "Homepage banner",
        hint: isFr ? "Apres 2 lignes de produits" : "After 2 product rows",
      },
      {
        value: "HOME_PRODUCT_CARD",
        label: isFr ? "Carte produit" : "Product card",
        hint: isFr ? "Integree dans la grille" : "Inside the product grid",
      },
      {
        value: "HOME_POPUP",
        label: isFr ? "Popup accueil" : "Homepage popup",
        hint: isFr ? "Encart premium flottant" : "Premium floating popup",
      },
    ],
    [isFr, verticalLabel]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      setSuccess(false);
      setSubmitting(false);
      setUploadingField(null);
    }
  }, [open]);

  async function uploadAsset(field: "logoUrl" | "imageUrl", file?: File | null) {
    if (!file) return;

    setUploadingField(field);
    setFeedback(null);

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error(isFr ? "Merci d'utiliser une image." : "Please upload an image.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("scope", "ad-request");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || typeof data?.url !== "string") {
        throw new Error(data?.error || (isFr ? "Upload impossible." : "Upload failed."));
      }

      setForm((current) => ({ ...current, [field]: data.url }));
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : isFr
            ? "Impossible de televerser ce fichier."
            : "We could not upload this file."
      );
      setSuccess(false);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/ad-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          locale,
          sourceVertical,
          ctaLabel: form.ctaLabel || (isFr ? "Voir le site" : "Visit site"),
        }),
      });

      if (!response.ok) {
        throw new Error("SUBMIT_FAILED");
      }

      setSuccess(true);
      setFeedback(
        isFr
          ? "Demande envoyee. Elle sera relue puis validee dans l'espace admin."
          : "Request sent. It will be reviewed and validated in admin."
      );
      setForm(initialState);
    } catch {
      setSuccess(false);
      setFeedback(
        isFr
          ? "Impossible d'envoyer la demande pour l'instant."
          : "We could not submit the request right now."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !mounted) return null;

  const inputClassName =
    "h-11 rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/15";
  const textareaClassName =
    "min-h-[108px] rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/15";

  return createPortal(
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        aria-label={isFr ? "Fermer la demande de pub" : "Close ad request"}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isFr ? "Demander une publicite" : "Request an ad"}
        className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-[620px]"
      >
        <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="border-b border-zinc-800 p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                  {isFr ? "Visibilite sponsorisee" : "Sponsored visibility"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {isFr ? `Demander une pub sur ${verticalLabel}` : `Request an ad on ${verticalLabel}`}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {isFr
                    ? "Partage ton site, ton offre, tes visuels et le format souhaite. L'equipe revoit ensuite la demande, le cadrage et les conditions de diffusion payante."
                    : "Share your site, offer, visuals, and preferred format. The team will review the request, scope, and paid placement conditions."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {isFr ? "Fermer" : "Close"}
              </button>
            </div>
          </div>

          <form className="flex-1 overflow-y-auto p-4 md:p-5" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <section className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Marque / societe" : "Brand / company"}
                    <input
                      className={inputClassName}
                      value={form.companyName}
                      onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Contact principal" : "Main contact"}
                    <input
                      className={inputClassName}
                      value={form.contactName}
                      onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    Email
                    <input
                      type="email"
                      className={inputClassName}
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Telephone" : "Phone"}
                    <input
                      className={inputClassName}
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </label>
                  <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Site / URL cible" : "Site / target URL"}
                    <input
                      type="url"
                      className={inputClassName}
                      placeholder="https://..."
                      value={form.websiteUrl}
                      onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))}
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                <div className="grid gap-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Titre de campagne" : "Campaign title"}
                    <input
                      className={inputClassName}
                      value={form.campaignTitle}
                      onChange={(event) => setForm((current) => ({ ...current, campaignTitle: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Description" : "Description"}
                    <textarea
                      className={textareaClassName}
                      value={form.campaignDescription}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, campaignDescription: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      {isFr ? "CTA souhaite" : "Preferred CTA"}
                      <input
                        className={inputClassName}
                        value={form.ctaLabel}
                        onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                        placeholder={isFr ? "Voir le site" : "Visit site"}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      {isFr ? "Budget indicatif" : "Indicative budget"}
                      <input
                        className={inputClassName}
                        value={form.budget}
                        onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
                        placeholder={isFr ? "Ex: 150 000 FCFA" : "Ex: 150,000 XOF"}
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {isFr ? "Format souhaite" : "Preferred format"}
                </p>
                <div className="mt-3 grid gap-3">
                  {placements.map((placement) => {
                    const isSelected = form.desiredPlacement === placement.value;
                    return (
                      <button
                        key={placement.value}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({ ...current, desiredPlacement: placement.value }))
                        }
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                            : "border-white/10 bg-white/5 text-zinc-200 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <p className="text-sm font-semibold">{placement.label}</p>
                        <p className="mt-1 text-xs text-zinc-400">{placement.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-xs text-zinc-300">
                    {isFr ? "Logo (optionnel)" : "Logo (optional)"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      onChange={(event) => void uploadAsset("logoUrl", event.target.files?.[0] ?? null)}
                      className="rounded-xl border border-dashed border-white/10 bg-zinc-950/60 px-3 py-3 text-sm text-zinc-200"
                    />
                    {form.logoUrl ? (
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                          <Image
                            src={form.logoUrl}
                            alt="Logo preview"
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-zinc-300">{form.logoUrl}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, logoUrl: "" }))}
                          className="text-[11px] text-rose-200"
                        >
                          {isFr ? "Retirer" : "Remove"}
                        </button>
                      </div>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-2 text-xs text-zinc-300">
                    {isFr ? "Visuel principal (optionnel)" : "Main visual (optional)"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => void uploadAsset("imageUrl", event.target.files?.[0] ?? null)}
                      className="rounded-xl border border-dashed border-white/10 bg-zinc-950/60 px-3 py-3 text-sm text-zinc-200"
                    />
                    {form.imageUrl ? (
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="relative h-12 w-16 overflow-hidden rounded-lg">
                          <Image
                            src={form.imageUrl}
                            alt="Visual preview"
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-zinc-300">{form.imageUrl}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, imageUrl: "" }))}
                          className="text-[11px] text-rose-200"
                        >
                          {isFr ? "Retirer" : "Remove"}
                        </button>
                      </div>
                    ) : null}
                  </label>

                  <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
                    {isFr ? "Notes pour l'equipe" : "Notes for the team"}
                    <textarea
                      className="min-h-[88px] rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/15"
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                </div>
              </section>
            </div>

            {uploadingField ? (
              <p className="mt-4 text-xs text-zinc-400">
                {isFr
                  ? `Televersement ${uploadingField === "logoUrl" ? "du logo" : "du visuel"}...`
                  : `Uploading ${uploadingField === "logoUrl" ? "logo" : "visual"}...`}
              </p>
            ) : null}

            {feedback ? (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                  success
                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                    : "border-rose-300/20 bg-rose-400/10 text-rose-100"
                }`}
              >
                {feedback}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xs text-xs leading-5 text-zinc-500">
                {isFr
                  ? "Chaque demande est relue avant publication. Si elle est validee, un brouillon sponsorise est prepare puis publie seulement apres reglement."
                  : "Every request is reviewed before launch. If approved, a sponsored draft is prepared and only goes live after payment."}
              </p>
              <button
                type="submit"
                disabled={submitting || uploadingField !== null}
                className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting
                  ? isFr
                    ? "Envoi..."
                    : "Sending..."
                  : isFr
                    ? "Envoyer la demande"
                    : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
