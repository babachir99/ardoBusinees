"use client";

import { useTranslations, useLocale } from "next-intl";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";
import { Link } from "@/i18n/navigation";

export default function CheckoutSummary() {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const { items, subtotalCents } = useCart();

  const feesCents = Math.round(subtotalCents * 0.04);
  const totalCents = subtotalCents + feesCents;

  if (items.length === 0) {
    return (
      <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="mt-3 text-sm text-zinc-300">{t("emptyDesc")}</p>
        <Link
          href="/shop"
          className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
        >
          {t("emptyCta")}
        </Link>
      </aside>
    );
  }

  return (
    <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8">
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
      <button className="mt-6 w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950">
        {t("summary.pay")}
      </button>
      <p className="mt-3 text-xs text-zinc-400">{t("summary.note")}</p>
    </aside>
  );
}
