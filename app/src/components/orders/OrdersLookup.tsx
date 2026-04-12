"use client";

import { useTranslations } from "next-intl";

export default function OrdersLookup() {
  const t = useTranslations("Orders");

  return (
    <div className="rounded-3xl border border-amber-400/20 bg-zinc-900/70 p-8">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-300">{t("secureAccessNote")}</p>
    </div>
  );
}
