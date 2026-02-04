import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Footer from "@/components/layout/Footer";

export default function SellerPage() {
  const t = useTranslations("Seller");

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[115px] w-auto md:h-[135px]"
            priority
          />
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.admin")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-300/15 via-zinc-900 to-zinc-900 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
            {t("hero.kicker")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">{t("hero.subtitle")}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-zinc-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              {t("hero.badges.orders")}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {t("hero.badges.preorder")}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {t("hero.badges.dropship")}
            </span>
          </div>
          <Link
            href="/seller/products/new"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-5 py-2 text-xs font-semibold text-zinc-950"
          >
            {t("cta.newProduct")}
          </Link>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6"
            >
              <p className="text-xs font-semibold text-amber-200">
                {t(`stats.${index}.label`)}
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {t(`stats.${index}.value`)}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {t(`stats.${index}.note`)}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h2 className="text-xl font-semibold">{t("cards.products")}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {t("cards.productsDesc")}
            </p>
            <div className="mt-6 grid gap-3 text-xs text-zinc-400">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.productsLine1")}
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.productsLine2")}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h2 className="text-xl font-semibold">{t("cards.orders")}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {t("cards.ordersDesc")}
            </p>
            <div className="mt-6 grid gap-3 text-xs text-zinc-400">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.ordersLine1")}
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                {t("cards.ordersLine2")}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-400/10 p-8">
          <h2 className="text-xl font-semibold">{t("payouts.title")}</h2>
          <p className="mt-2 text-sm text-zinc-300">{t("payouts.desc")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">
              {t("payouts.badge1")}
            </span>
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">
              {t("payouts.badge2")}
            </span>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
