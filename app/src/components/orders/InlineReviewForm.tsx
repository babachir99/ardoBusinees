"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type InlineReviewFormProps = {
  productId: string;
};

export default function InlineReviewForm({ productId }: InlineReviewFormProps) {
  const t = useTranslations("Orders");

  const [rating, setRating] = useState(5);
  const [sellerRating, setSellerRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    if (sending) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          sellerRating,
          title,
          comment,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || t("detail.reviewForm.error"));
      }

      setSuccess(t("detail.reviewForm.success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.reviewForm.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(10,13,18,0.96))] p-4 shadow-[0_22px_60px_-36px_rgba(16,185,129,0.32)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {t("detail.reviewForm.title")}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {t("detail.reviewForm.commentPlaceholder")}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          {t("detail.reviewCta")}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
            {t("detail.reviewForm.productRating")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={`product-${value}`}
                type="button"
                onClick={() => setRating(value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition duration-200 ${
                  value <= rating
                    ? "border-amber-300/70 bg-amber-300/15 text-amber-200 shadow-[0_10px_24px_-18px_rgba(251,191,36,0.8)]"
                    : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
            {t("detail.reviewForm.sellerRating")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={`seller-${value}`}
                type="button"
                onClick={() => setSellerRating(value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition duration-200 ${
                  value <= sellerRating
                    ? "border-sky-300/70 bg-sky-300/15 text-sky-200 shadow-[0_10px_24px_-18px_rgba(56,189,248,0.8)]"
                    : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder={t("detail.reviewForm.titlePlaceholder")}
          className="rounded-2xl border border-white/10 bg-zinc-900/85 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/30"
        />

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1200}
          placeholder={t("detail.reviewForm.commentPlaceholder")}
          className="min-h-28 rounded-2xl border border-white/10 bg-zinc-900/85 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/30"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-500">
            {title.length}/80 · {comment.length}/1200
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="inline-flex rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 disabled:opacity-60"
          >
            {sending ? t("detail.reviewForm.saving") : t("detail.reviewForm.submit")}
          </button>
        </div>
      </div>

      {success && <p className="mt-3 text-[11px] text-emerald-300">{success}</p>}
      {error && <p className="mt-3 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
