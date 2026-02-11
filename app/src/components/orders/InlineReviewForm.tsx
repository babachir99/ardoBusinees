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
    <div className="mt-2 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
      <p className="text-xs font-semibold text-white">{t("detail.reviewForm.title")}</p>

      <div className="mt-3 grid gap-3">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {t("detail.reviewForm.productRating")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={`product-${value}`}
                type="button"
                onClick={() => setRating(value)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  value <= rating
                    ? "border-amber-300/70 bg-amber-300/15 text-amber-200"
                    : "border-white/10 bg-zinc-900 text-zinc-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-400">
            {t("detail.reviewForm.sellerRating")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={`seller-${value}`}
                type="button"
                onClick={() => setSellerRating(value)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  value <= sellerRating
                    ? "border-sky-300/70 bg-sky-300/15 text-sky-200"
                    : "border-white/10 bg-zinc-900 text-zinc-400"
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
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
        />

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1200}
          placeholder={t("detail.reviewForm.commentPlaceholder")}
          className="min-h-24 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
        />

        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="inline-flex w-fit rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
        >
          {sending ? t("detail.reviewForm.saving") : t("detail.reviewForm.submit")}
        </button>
      </div>

      {success && <p className="mt-2 text-[11px] text-emerald-300">{success}</p>}
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}