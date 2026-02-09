"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";

export default function CartView() {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const { items, updateQuantity, removeItem, clear, subtotalCents } = useCart();

  const feesCents = Math.round(subtotalCents * 0.04);
  const totalCents = subtotalCents + feesCents;

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-10 text-center">
        <h1 className="text-2xl font-semibold">{t("emptyTitle")}</h1>
        <p className="mt-3 text-sm text-zinc-300">{t("emptyDesc")}</p>
        <Link
          href="/shop"
          className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
        >
          {t("continue")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-zinc-400 underline decoration-white/20"
          >
            {t("clear")}
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {items.map((item) => (
            <div
              key={item.lineId}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {item.type === "PREORDER"
                    ? t("labels.preorder")
                    : item.type === "LOCAL"
                    ? locale === "fr"
                      ? "Local"
                      : "Local"
                    : t("labels.dropship")}
                </p>
                {(item.optionColor || item.optionSize) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.optionColor
                      ? `${locale === "fr" ? "Couleur" : "Color"}: ${item.optionColor}`
                      : ""}
                    {item.optionColor && item.optionSize ? " � " : ""}
                    {item.optionSize
                      ? `${locale === "fr" ? "Taille" : "Size"}: ${item.optionSize}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-300">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                  className="rounded-full border border-white/15 px-3 py-1"
                >
                  -
                </button>
                <span className="min-w-[24px] text-center">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  className="rounded-full border border-white/15 px-3 py-1"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="text-sm font-semibold text-emerald-200">
                  {formatMoney(item.priceCents, item.currency, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.lineId)}
                  className="text-xs text-zinc-400 underline decoration-white/20"
                >
                  {t("remove")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="h-fit rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8">
        <h2 className="text-xl font-semibold">{t("summary.title")}</h2>
        <div className="mt-5 grid gap-3 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span>{t("summary.subtotal")}</span>
            <span>{formatMoney(subtotalCents, "XOF", locale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("summary.fees")}</span>
            <span>{formatMoney(feesCents, "XOF", locale)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-white">
            <span>{t("summary.total")}</span>
            <span>{formatMoney(totalCents, "XOF", locale)}</span>
          </div>
        </div>
        <Link
          href="/checkout"
          className="mt-6 block rounded-full bg-emerald-400 px-6 py-3 text-center text-sm font-semibold text-zinc-950"
        >
          {t("summary.cta")}
        </Link>
      </aside>
    </div>
  );
}
