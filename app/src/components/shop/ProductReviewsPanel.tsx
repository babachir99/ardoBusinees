"use client";

import { useMemo, useState } from "react";

type ReviewItem = {
  id: string;
  rating: number;
  sellerRating?: number | null;
  title?: string | null;
  comment?: string | null;
  createdAt: string;
  mine?: boolean;
  buyer?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
};

type ReviewSubmitResponse = ReviewItem & {
  stats?: {
    average?: number;
    count?: number;
  };
};

type ProductReviewsPanelProps = {
  locale: string;
  productId: string;
  isAuthenticated: boolean;
  canReview: boolean;
  isSellerOwner: boolean;
  initialAverage: number;
  initialCount: number;
  initialReviews: ReviewItem[];
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-300" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={step <= value ? "opacity-100" : "opacity-25"}>
          {"\u2605"}
        </span>
      ))}
    </span>
  );
}

export default function ProductReviewsPanel({
  locale,
  productId,
  isAuthenticated,
  canReview,
  isSellerOwner,
  initialAverage,
  initialCount,
  initialReviews,
}: ProductReviewsPanelProps) {
  const isFr = locale === "fr";
  const [rating, setRating] = useState(5);
  const [sellerRating, setSellerRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [count, setCount] = useState(initialCount);
  const [average, setAverage] = useState(initialAverage);

  const canSubmit = useMemo(() => canReview && isAuthenticated && !isSellerOwner, [canReview, isAuthenticated, isSellerOwner]);

  const submitReview = async () => {
    if (!canSubmit || pending) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          sellerRating,
          title,
          comment,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Review request failed");
      }

      const created = (await res.json()) as ReviewSubmitResponse;
      const withoutMine = reviews.filter((item) => !item.mine);
      const next = [{ ...created, mine: true }, ...withoutMine];
      setReviews(next);
      setCount(
        typeof created.stats?.count === "number" ? created.stats.count : next.length
      );
      setAverage(
        typeof created.stats?.average === "number"
          ? created.stats.average
          : next.length > 0
          ? next.reduce((sum, item) => sum + item.rating, 0) / next.length
          : 0
      );
      setTitle("");
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review request failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <section id="reviews" className="mx-auto mb-16 w-full max-w-6xl px-6 fade-up">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {isFr ? "Avis produit" : "Product reviews"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {isFr ? "Notes verifiees apres achat" : "Ratings from verified purchases"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-right">
            <p className="text-sm text-zinc-400">{isFr ? "Note moyenne" : "Average"}</p>
            <p className="text-xl font-semibold text-amber-300">
              {average.toFixed(1)} <span className="text-sm text-zinc-500">({count})</span>
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
            <p className="text-sm font-semibold text-white">
              {isFr ? "Laisser un avis" : "Leave a review"}
            </p>

            {!isAuthenticated && (
              <p className="mt-2 text-xs text-zinc-500">
                {isFr ? "Connecte-toi pour publier un avis." : "Sign in to publish a review."}
              </p>
            )}

            {isSellerOwner && (
              <p className="mt-2 text-xs text-zinc-500">
                {isFr ? "Tu ne peux pas noter ton propre produit." : "You cannot review your own product."}
              </p>
            )}

            {isAuthenticated && !canReview && !isSellerOwner && (
              <p className="mt-2 text-xs text-zinc-500">
                {isFr
                  ? "Avis disponible apres une commande payee de ce produit."
                  : "Review becomes available after a paid order for this product."}
              </p>
            )}

            <div className="mt-4 grid gap-3">
              <label className="text-xs uppercase tracking-wide text-zinc-400">
                {isFr ? "Note produit" : "Product rating"}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setRating(step)}
                    className={`rounded-lg border px-2 py-1 text-sm ${
                      step <= rating
                        ? "border-amber-300/70 bg-amber-300/15 text-amber-200"
                        : "border-white/10 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {step}
                  </button>
                ))}
              </div>

              <label className="text-xs uppercase tracking-wide text-zinc-400">
                {isFr ? "Note vendeur" : "Seller rating"}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <button
                    key={`seller-${step}`}
                    type="button"
                    onClick={() => setSellerRating(step)}
                    className={`rounded-lg border px-2 py-1 text-sm ${
                      step <= sellerRating
                        ? "border-sky-300/70 bg-sky-300/15 text-sky-200"
                        : "border-white/10 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {step}
                  </button>
                ))}
              </div>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder={isFr ? "Titre court (optionnel)" : "Short title (optional)"}
                className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                disabled={!canSubmit || pending}
              />

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1200}
                placeholder={isFr ? "Ton retour d'experience" : "Your feedback"}
                className="min-h-24 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                disabled={!canSubmit || pending}
              />

              <button
                type="button"
                onClick={submitReview}
                disabled={!canSubmit || pending}
                className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {pending ? (isFr ? "Publication..." : "Publishing...") : isFr ? "Publier" : "Submit"}
              </button>
            </div>

            {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
          </div>

          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                {isFr ? "Aucun avis pour le moment." : "No reviews yet."}
              </div>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {review.buyer?.name || (isFr ? "Client" : "Customer")}
                        {review.mine ? (
                          <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200">
                            {isFr ? "Toi" : "You"}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {new Date(review.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Stars value={review.rating} />
                      {typeof review.sellerRating === "number" && (
                        <p className="mt-1 text-[11px] text-sky-200">
                          {isFr ? "Vendeur" : "Seller"}: {review.sellerRating}/5
                        </p>
                      )}
                    </div>
                  </div>

                  {review.title && <p className="mt-2 text-sm font-semibold text-zinc-100">{review.title}</p>}
                  {review.comment && <p className="mt-1 text-sm text-zinc-300">{review.comment}</p>}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

