import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function CartPage() {
  const t = useTranslations("Cart");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ardoBusiness
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.shop")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24 md:flex-row">
        <section className="flex-1 rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-3 text-sm text-zinc-300">{t("subtitle")}</p>

          <div className="mt-6 grid gap-4">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {t(`items.${item}.name`)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {t(`items.${item}.type`)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <span>{t("labels.qty")}</span>
                  <span className="rounded-full border border-white/15 px-3 py-1">
                    1
                  </span>
                </div>
                <p className="text-sm font-semibold text-emerald-200">
                  {t(`items.${item}.price`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8">
          <h2 className="text-xl font-semibold">{t("summary.title")}</h2>
          <div className="mt-5 grid gap-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>{t("summary.subtotal")}</span>
              <span>154,500 CFA</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("summary.fees")}</span>
              <span>6,500 CFA</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-white">
              <span>{t("summary.total")}</span>
              <span>161,000 CFA</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="mt-6 block rounded-full bg-emerald-400 px-6 py-3 text-center text-sm font-semibold text-zinc-950"
          >
            {t("summary.cta")}
          </Link>
        </aside>
      </main>
    </div>
  );
}
