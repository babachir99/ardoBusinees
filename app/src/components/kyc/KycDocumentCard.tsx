"use client";

type KycDocumentCardProps = {
  fieldKey: string;
  label: string;
  value: string;
  required?: boolean;
  isUploadField?: boolean;
  previewUrl?: string;
  helperText?: string;
  uploading?: boolean;
  uploadLabel: string;
  removeLabel: string;
  readyLabel: string;
  onChange: (value: string) => void;
  onUpload: (file: File | null) => void;
  onClear: () => void;
};

export default function KycDocumentCard({
  fieldKey,
  label,
  value,
  required = false,
  isUploadField = false,
  previewUrl,
  helperText,
  uploading = false,
  uploadLabel,
  removeLabel,
  readyLabel,
  onChange,
  onUpload,
  onClear,
}: KycDocumentCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 transition-all duration-200 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-emerald-300/35 hover:shadow-[0_12px_28px_rgba(0,0,0,0.3)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${
            required
              ? "border border-amber-300/35 bg-amber-400/15 text-amber-100"
              : "border border-white/15 bg-zinc-900/70 text-zinc-300"
          }`}
        >
          {required ? "Requis" : "Optionnel"}
        </span>
      </div>

      {helperText ? <p className="mt-2 text-[11px] text-zinc-500">{helperText}</p> : null}

      <input
        className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/40"
        value={value}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
      />

      {previewUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          <img src={previewUrl} alt={`${fieldKey}-preview`} className="h-28 w-full object-cover" />
        </div>
      ) : null}

      {isUploadField ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-4 py-2 text-[11px] text-zinc-200 transition hover:border-emerald-300/40 hover:text-white">
            {uploading ? `${uploadLabel}...` : uploadLabel}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => {
                onUpload(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>

          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-white/20 px-4 py-2 text-[11px] text-zinc-200 transition hover:border-white/40"
            >
              {removeLabel}
            </button>
          ) : null}

          {value ? (
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-200">
              {readyLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
