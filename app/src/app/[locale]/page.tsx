import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ardoBusiness
        </Link>
        <nav className="flex items-center gap-6 text-sm text-zinc-300">
          <Link href="/shop" className="transition hover:text-white">
            {t("nav.market")}
          </Link>
          <Link href="/shop" className="transition hover:text-white">
            {t("nav.services")}
          </Link>
          <Link href="/seller" className="transition hover:text-white">
            {t("nav.sellers")}
          </Link>
          <Link href="/shop" className="transition hover:text-white">
            {t("nav.contact")}
          </Link>
        </nav>
        <Link
          href="/cart"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.cart")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-10">
        <section className="grid gap-10 rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-10 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
              {t("hero.kicker")}
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="text-base text-zinc-300 md:text-lg">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/shop"
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 text-center"
              >
                {t("hero.ctaPrimary")}
              </Link>
              <Link
                href="/shop"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-center"
              >
                {t("hero.ctaSecondary")}
              </Link>
            </div>
          </div>
          <div className="grid gap-4 rounded-2xl bg-zinc-950/70 p-6">
            <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
              <p className="text-sm text-emerald-200">{t("hero.card1Title")}</p>
              <p className="mt-2 text-2xl font-semibold">
                {t("hero.card1Value")}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {t("hero.card1Note")}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
              <p className="text-sm text-emerald-200">{t("hero.card2Title")}</p>
              <p className="mt-2 text-2xl font-semibold">
                {t("hero.card2Value")}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {t("hero.card2Note")}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6"
            >
              <p className="text-sm font-semibold text-emerald-200">
                {t(`features.${index}.title`)}
              </p>
              <p className="mt-3 text-sm text-zinc-300">
                {t(`features.${index}.desc`)}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 rounded-3xl border border-white/10 bg-zinc-900/70 p-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">{t("flow.title")}</h2>
            <p className="mt-3 text-sm text-zinc-300">
              {t("flow.subtitle")}
            </p>
          </div>
          <div className="grid gap-4">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
              >
                <p className="text-sm font-semibold">
                  {t(`flow.steps.${index}.title`)}
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  {t(`flow.steps.${index}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/20 via-emerald-400/5 to-transparent p-8">
            <h3 className="text-xl font-semibold">{t("preorder.title")}</h3>
            <p className="mt-3 text-sm text-zinc-200">
              {t("preorder.desc")}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 p-8">
            <h3 className="text-xl font-semibold">{t("dropship.title")}</h3>
            <p className="mt-3 text-sm text-zinc-300">
              {t("dropship.desc")}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-10 text-center">
          <h2 className="text-2xl font-semibold">{t("seller.title")}</h2>
          <p className="mt-3 text-sm text-zinc-300">
            {t("seller.desc")}
          </p>
          <button className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950">
            {t("seller.cta")}
          </button>
        </section>
      </main>
    </div>
  );
}
