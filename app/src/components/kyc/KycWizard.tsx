"use client";

import { useMemo, useState } from "react";
import KycDocumentCard from "@/components/kyc/KycDocumentCard";

type KycRequirement = {
  roleRequested: string;
  kycType: "INDIVIDUAL" | "BUSINESS";
  kycLevel: "BASIC" | "ENHANCED" | "PROFESSIONAL";
  requiredFields: string[];
  optionalFields: string[];
};

type KycWizardProps = {
  isFr: boolean;
  selectedRole: string;
  kycStatus: string | null;
  kycSubmission: { reviewReason?: string | null } | null;
  requirement: KycRequirement | null;
  requirementLoading: boolean;
  fieldLabels: Record<string, string>;
  uploadFields: Set<string>;
  countries: Array<{ code: string; name: string }>;
  getCountryFlag: (country: string) => string;
  profilePhone?: string | null;
  values: Record<string, string>;
  previews: Record<string, string>;
  uploadingField: string | null;
  loading: boolean;
  onChangeField: (field: string, value: string) => void;
  onUploadField: (field: string, file: File | null) => void;
  onClearField: (field: string) => void;
  onSubmit: () => void;
};

type WizardStep = 1 | 2 | 3;

const INFO_FIELDS = ["addressCity", "addressCountry", "phoneVerified"] as const;
const INFO_FIELDS_SET = new Set<string>(INFO_FIELDS);

function getStatusLabel(status: string | null, isFr: boolean) {
  if (status === "APPROVED") return isFr ? "VERIFIE" : "VERIFIED";
  if (status === "REJECTED") return isFr ? "REFUSE" : "REJECTED";
  if (status === "PENDING") return isFr ? "EN ATTENTE" : "PENDING";
  return isFr ? "NON DEMARRE" : "NOT STARTED";
}

function getStatusClass(status: string | null) {
  if (status === "APPROVED") return "bg-emerald-400/20 text-emerald-200 border-emerald-300/35";
  if (status === "REJECTED") return "bg-rose-400/20 text-rose-200 border-rose-300/35";
  if (status === "PENDING") return "bg-amber-400/20 text-amber-200 border-amber-300/35";
  return "bg-zinc-700/50 text-zinc-200 border-zinc-500/35";
}

function getRoleTips(role: string, isFr: boolean) {
  if (role === "GP_CARRIER") {
    return isFr
      ? ["Passeport net et lisible", "Selfie visage centré", "Justificatif voyage au moment du publish trip"]
      : ["Use a clear passport image", "Selfie with centered face", "Travel proof when publishing a trip"];
  }

  if (role === "TIAK_COURIER") {
    return isFr
      ? ["Pièce d'identité sans reflet", "Permis lisible (recto/verso)", "Photo selfie bien éclairée"]
      : ["Identity document without glare", "Readable driving license", "Well-lit selfie image"];
  }

  if (role === "IMMO_AGENCY" || role === "CAR_DEALER") {
    return isFr
      ? ["RCCM/NINEA ou KBIS/SIRET lisible", "RIB entreprise au nom exact", "Pièce du représentant légal valide"]
      : ["Readable business registration", "Company RIB with exact legal name", "Valid legal representative ID"];
  }

  return isFr
    ? ["Photo lisible, sans reflet", "Nom et adresse cohérents", "Vérification manuelle sous 24-72h"]
    : ["Clear images without glare", "Consistent name and address", "Manual review within 24-72h"];
}

function getFieldHelper(field: string, isFr: boolean) {
  if (field === "passportUrl") {
    return isFr ? "Photo nette de la page identité du passeport." : "Clear image of passport identity page.";
  }
  if (field === "driverLicenseUrl") {
    return isFr ? "Ajoute un document lisible (recto/verso conseillé)." : "Provide a readable document (front/back recommended).";
  }
  if (field === "selfieUrl") {
    return isFr ? "Visage centré, sans filtre." : "Face centered, no filter.";
  }
  if (field === "businessRegistrationUrl") {
    return isFr
      ? "France: KBIS/SIRET • Sénégal: RCCM/NINEA."
      : "France: KBIS/SIRET • Senegal: RCCM/NINEA.";
  }
  if (field === "companyRibUrl") {
    return isFr ? "RIB entreprise officiel." : "Official company bank RIB.";
  }
  return isFr ? "Image ou PDF lisible." : "Readable image or PDF.";
}

export default function KycWizard({
  isFr,
  selectedRole,
  kycStatus,
  kycSubmission,
  requirement,
  requirementLoading,
  fieldLabels,
  uploadFields,
  countries,
  getCountryFlag,
  profilePhone,
  values,
  previews,
  uploadingField,
  loading,
  onChangeField,
  onUploadField,
  onClearField,
  onSubmit,
}: KycWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [showHelp, setShowHelp] = useState(false);
  const [showSummaryMobile, setShowSummaryMobile] = useState(false);


  const requiredFields = requirement?.requiredFields ?? [];
  const optionalFields = requirement?.optionalFields ?? [];

  const isFieldFilled = (field: string) => {
    if (field === "phoneVerified") {
      return Boolean(profilePhone?.trim());
    }
    return Boolean(values[field]?.trim());
  };

  const missingRequiredFields = requiredFields.filter((field) => !isFieldFilled(field));
  const filledRequiredCount = requiredFields.length - missingRequiredFields.length;
  const progress = requiredFields.length > 0 ? Math.round((filledRequiredCount / requiredFields.length) * 100) : 0;

  const infoFieldsToRender = INFO_FIELDS.filter(
    (field) => requiredFields.includes(field) || optionalFields.includes(field)
  );

  const requiredInfoMissing = requiredFields.filter(
    (field) => INFO_FIELDS_SET.has(field) || field === "phoneVerified"
  ).filter((field) => !isFieldFilled(field));

  const requiredDocumentFields = requiredFields.filter(
    (field) => !INFO_FIELDS_SET.has(field) && field !== "phoneVerified"
  );
  const requiredDocumentMissing = requiredDocumentFields.filter((field) => !isFieldFilled(field));

  const optionalWizardFields = optionalFields.filter(
    (field) => !requiredFields.includes(field) && !INFO_FIELDS_SET.has(field) && field !== "phoneVerified"
  );

  const canContinue =
    step === 1 ? requiredInfoMissing.length === 0 : step === 2 ? requiredDocumentMissing.length === 0 : true;

  const canSubmit = requiredFields.length > 0 && missingRequiredFields.length === 0 && !loading;

  const tips = useMemo(() => getRoleTips(selectedRole, isFr), [selectedRole, isFr]);

  return (
    <div className="relative mx-auto w-full max-w-5xl pb-1">
      <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900/90 via-zinc-900/80 to-zinc-900/70 p-4 shadow-[0_16px_42px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{isFr ? "Vérification KYC" : "KYC Verification"}</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {isFr
                ? "Dépose tes documents pour débloquer les fonctions pro."
                : "Submit your documents to unlock professional features."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-zinc-200">{selectedRole}</span>
            <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-zinc-200">
              {requirement?.kycType ?? "-"}
            </span>
            <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-zinc-200">
              {requirement?.kycLevel ?? "-"}
            </span>
            <button
              type="button"
              aria-label={isFr ? "Aide KYC" : "KYC help"}
              onClick={() => setShowHelp(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-zinc-950/70 text-zinc-200 transition hover:border-white/40"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <circle cx="10" cy="10" r="8" />
                <path d="M10 8.2v4" strokeLinecap="round" />
                <circle cx="10" cy="6" r=".75" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
          <span>{isFr ? "Données chiffrées" : "Encrypted data"}</span>
          <span aria-hidden="true">•</span>
          <span>{isFr ? "Vérification manuelle" : "Manual review"}</span>
          <span aria-hidden="true">•</span>
          <span>{isFr ? "Réponse sous 24-72h" : "Response within 24-72h"}</span>
        </div>
      </div>

      {kycStatus === "REJECTED" && kycSubmission?.reviewReason ? (
        <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs text-rose-100">
          <p className="font-semibold">{isFr ? "Motif de refus" : "Rejection reason"}</p>
          <p className="mt-1 text-rose-100/90">{kycSubmission.reviewReason}</p>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={showSummaryMobile}
        onClick={() => setShowSummaryMobile((prev) => !prev)}
        className="mb-3 inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 lg:hidden"
      >
        <span>{isFr ? "Résumé KYC" : "KYC summary"}</span>
        <span className="text-xs text-zinc-400">{showSummaryMobile ? "-" : "+"}</span>
      </button>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`${showSummaryMobile ? "block" : "hidden"} space-y-3 lg:sticky lg:top-6 lg:block lg:self-start`}
        >
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              {isFr ? "Statut dossier" : "Dossier status"}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-400">{isFr ? "KYC" : "KYC"}</span>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getStatusClass(kycStatus)}`}>
                {getStatusLabel(kycStatus, isFr)}
              </span>
            </div>

            <div className="mt-4">
              <div className="h-2.5 rounded-full bg-zinc-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                {filledRequiredCount}/{requiredFields.length || 0} {isFr ? "requis complétés" : "required completed"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold text-zinc-200">{isFr ? "Checklist requise" : "Required checklist"}</p>
            {requiredFields.length === 0 ? (
              <p className="mt-2 text-[11px] text-zinc-500">
                {isFr ? "Choisis un rôle pour afficher les exigences." : "Choose a role to load requirements."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {requiredFields.map((field) => {
                  const filled = isFieldFilled(field);
                  return (
                    <li key={field} className="flex items-start gap-2 text-[11px] text-zinc-300">
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                          filled
                            ? "border-emerald-300/45 bg-emerald-400/15 text-emerald-200"
                            : "border-zinc-600/70 text-zinc-500"
                        }`}
                      >
                        {filled ? (
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
                            <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full border border-current" />
                        )}
                      </span>
                      <span>{fieldLabels[field] ?? field}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold text-zinc-200">{isFr ? "Conseils" : "Tips"}</p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-400">
              {tips.map((tip) => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/55 p-4 md:p-5">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {[
              isFr ? "Informations" : "Information",
              isFr ? "Documents requis" : "Required docs",
              isFr ? "Optionnels & notes" : "Optional & notes",
            ].map((label, index) => {
              const stepValue = (index + 1) as WizardStep;
              const active = stepValue === step;
              const done = step > stepValue;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (stepValue < step || (stepValue === 2 && requiredInfoMissing.length === 0) || stepValue === 1) {
                      setStep(stepValue);
                    }
                  }}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all duration-200 ease-out motion-reduce:transition-none ${
                    active
                      ? "border-emerald-300/50 bg-emerald-400/12 text-emerald-100"
                      : done
                      ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-zinc-900/70 text-zinc-400"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.14em]">{stepValue}</p>
                  <p className="mt-1 font-medium">{label}</p>
                </button>
              );
            })}
          </div>

          {requirementLoading ? (
            <p className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-400">
              {isFr ? "Chargement des exigences..." : "Loading requirements..."}
            </p>
          ) : null}

          <div
            key={`step-${step}`}
            className="grid gap-4 transition-all duration-300 ease-out motion-reduce:transition-none data-[state=enter]:opacity-100"
            data-state="enter"
          >
            {step === 1 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {infoFieldsToRender.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-zinc-950/65 px-4 py-3 text-xs text-zinc-400 md:col-span-2">
                    {isFr
                      ? "Aucune information supplémentaire requise pour ce rôle."
                      : "No additional information is required for this role."}
                  </p>
                ) : null}

                {infoFieldsToRender.map((field) => {
                  const isRequired = requiredFields.includes(field);

                  if (field === "phoneVerified") {
                    return (
                      <article key={field} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 md:col-span-2">
                        <p className="text-sm font-medium text-zinc-100">{fieldLabels[field] ?? field}</p>
                        <input
                          className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-white outline-none"
                          value={profilePhone ?? ""}
                          readOnly
                        />
                        {!profilePhone ? (
                          <p className="mt-2 text-[11px] text-rose-300">
                            {isFr
                              ? "Numéro requis: ajoute ton téléphone dans le profil avant l'envoi."
                              : "Phone required: add it to your profile before submitting."}
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-emerald-200">{isFr ? "Numéro détecté" : "Phone detected"}</p>
                        )}
                        {isRequired ? (
                          <span className="mt-2 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100">
                            {isFr ? "Requis" : "Required"}
                          </span>
                        ) : null}
                      </article>
                    );
                  }

                  if (field === "addressCountry") {
                    return (
                      <article key={field} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                        <p className="text-sm font-medium text-zinc-100">{fieldLabels[field] ?? field}</p>
                        <select
                          className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                          value={values[field] ?? ""}
                          onChange={(event) => onChangeField(field, event.target.value)}
                        >
                          {countries.map((country) => (
                            <option key={country.code} value={country.code}>
                              {`${getCountryFlag(country.code)} ${country.name}`.trim()}
                            </option>
                          ))}
                        </select>
                        {isRequired ? (
                          <span className="mt-2 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100">
                            {isFr ? "Requis" : "Required"}
                          </span>
                        ) : null}
                      </article>
                    );
                  }

                  return (
                    <article key={field} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                      <p className="text-sm font-medium text-zinc-100">{fieldLabels[field] ?? field}</p>
                      <input
                        className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                        value={values[field] ?? ""}
                        onChange={(event) => onChangeField(field, event.target.value)}
                        placeholder={fieldLabels[field] ?? field}
                      />
                      {isRequired ? (
                        <span className="mt-2 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100">
                          {isFr ? "Requis" : "Required"}
                        </span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-3">
                {requiredDocumentFields.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-zinc-950/65 px-4 py-3 text-xs text-zinc-400">
                    {isFr
                      ? "Aucun document obligatoire supplémentaire pour ce rôle."
                      : "No additional mandatory document for this role."}
                  </p>
                ) : (
                  requiredDocumentFields.map((field) => (
                    <KycDocumentCard
                      key={field}
                      fieldKey={field}
                      label={fieldLabels[field] ?? field}
                      value={values[field] ?? ""}
                      required
                      isUploadField={uploadFields.has(field)}
                      previewUrl={previews[field]}
                      helperText={getFieldHelper(field, isFr)}
                      uploading={uploadingField === field}
                      uploadLabel={isFr ? "Uploader" : "Upload"}
                      removeLabel={isFr ? "Retirer" : "Remove"}
                      readyLabel={isFr ? "Fichier prêt" : "File ready"}
                      onChange={(value) => onChangeField(field, value)}
                      onUpload={(file) => onUploadField(field, file)}
                      onClear={() => onClearField(field)}
                    />
                  ))
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-3">
                {optionalWizardFields.length > 0 ? (
                  <div className="grid gap-3">
                    {optionalWizardFields.map((field) => (
                      <KycDocumentCard
                        key={field}
                        fieldKey={field}
                        label={fieldLabels[field] ?? field}
                        value={values[field] ?? ""}
                        required={false}
                        isUploadField={uploadFields.has(field)}
                        previewUrl={previews[field]}
                        helperText={getFieldHelper(field, isFr)}
                        uploading={uploadingField === field}
                        uploadLabel={isFr ? "Uploader" : "Upload"}
                        removeLabel={isFr ? "Retirer" : "Remove"}
                        readyLabel={isFr ? "Fichier prêt" : "File ready"}
                        onChange={(value) => onChangeField(field, value)}
                        onUpload={(file) => onUploadField(field, file)}
                        onClear={() => onClearField(field)}
                      />
                    ))}
                  </div>
                ) : null}

                <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                  <p className="text-sm font-medium text-zinc-100">{isFr ? "Notes" : "Notes"}</p>
                  <textarea
                    className="mt-3 h-28 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
                    value={values.notes ?? ""}
                    placeholder={isFr ? "Ajoute un contexte utile pour l'équipe KYC" : "Add useful context for the KYC team"}
                    onChange={(event) => onChangeField("notes", event.target.value)}
                  />
                </article>

                <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                  <p className="text-sm font-semibold text-zinc-100">{isFr ? "Résumé avant envoi" : "Final summary"}</p>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                    {requiredFields.map((field) => {
                      const filled = isFieldFilled(field);
                      return (
                        <li key={`summary-${field}`} className="flex items-center justify-between gap-3">
                          <span>{fieldLabels[field] ?? field}</span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] ${
                              filled ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"
                            }`}
                          >
                            {filled ? (isFr ? "OK" : "DONE") : isFr ? "MANQUANT" : "MISSING"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev))}
              disabled={step === 1}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isFr ? "Retour" : "Back"}
            </button>

            <div className="flex items-center gap-2">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev < 3 ? ((prev + 1) as WizardStep) : prev))}
                  disabled={!canContinue}
                  className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 px-5 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isFr ? "Continuer" : "Continue"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 px-5 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? (isFr ? "Envoi..." : "Submitting...") : isFr ? "Envoyer le dossier" : "Submit dossier"}
                </button>
              )}
            </div>
          </div>

          {!canContinue && step < 3 ? (
            <p className="mt-2 text-xs text-rose-300">
              {isFr
                ? "Complète les champs requis de cette étape pour continuer."
                : "Complete required fields in this step to continue."}
            </p>
          ) : null}
        </section>
      </div>

      {showHelp ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h4 className="text-base font-semibold text-white">{isFr ? "Aide KYC" : "KYC help"}</h4>
            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <p>
                <span className="font-medium text-zinc-100">{isFr ? "Pourquoi KYC ?" : "Why KYC?"}</span>{" "}
                {isFr
                  ? "Pour sécuriser les transactions et débloquer les rôles pro."
                  : "To secure transactions and unlock professional roles."}
              </p>
              <p>
                <span className="font-medium text-zinc-100">{isFr ? "Quels documents ?" : "Which documents?"}</span>{" "}
                {isFr
                  ? "Les documents requis dépendent du rôle sélectionné."
                  : "Required documents depend on the selected role."}
              </p>
              <p>
                <span className="font-medium text-zinc-100">{isFr ? "Délais" : "Timeline"}</span>{" "}
                {isFr ? "Validation manuelle en 24-72h." : "Manual review in 24-72h."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-4 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
            >
              {isFr ? "Fermer" : "Close"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
