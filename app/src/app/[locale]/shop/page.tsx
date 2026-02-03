import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const products = [
  {
    id: "atlas-headphones",
    title: "Atlas Studio Headphones",
    price: "89,000 CFA",
    tag: "dropship",
    eta: "5-10 jours",
  },
  {
    id: "lune-smartwatch",
    title: "Lune Smartwatch Pro",
    price: "65,500 CFA",
    tag: "preorder",
    eta: "10-18 jours",
  },
  {
    id: "nova-backpack",
    title: "Nova Travel Backpack",
    price: "48,000 CFA",
    tag: "dropship",
    eta: "6-12 jours",
  },
  {
    id: "aurora-ringlight",
    title: "Aurora Ringlight Kit",
    price: "32,000 CFA",
    tag: "preorder",
    eta: "12-20 jours",
  },
];

export default function ShopPage() {
  const t = useTranslations("Shop");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ardoBusiness
        </Link>
        <div className="flex items-center gap-3 text-xs text-zinc-300">
          <span className="rounded-full border border-white/15 px-3 py-1">
            {t("filters.all")}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1">
            {t("filters.preorder")}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1">
            {t("filters.dropship")}
          </span>
        </div>
        <Link
          href="/cart"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("cart")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                {t("hero.kicker")}
              </p>
              <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
                {t("hero.title")}
              </h1>
              <p className="mt-3 text-sm text-zinc-300">
                {t("hero.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 px-5 py-4 text-xs text-zinc-300">
              <span>{t("hero.metrics.title")}</span>
              <span className="text-sm font-semibold text-emerald-200">
                320+
              </span>
              <span>{t("hero.metrics.note")}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/shop/${product.id}`}
              className="group rounded-3xl border border-white/10 bg-zinc-900/70 p-6 transition hover:border-emerald-300/60"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    product.tag === "preorder"
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-emerald-400/20 text-emerald-200"
                  }`}
                >
                  {product.tag === "preorder"
                    ? t("labels.preorder")
                    : t("labels.dropship")}
                </span>
                <span className="text-xs text-zinc-400">
                  {t("labels.eta", { days: product.eta })}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">{product.title}</h3>
              <p className="mt-2 text-sm text-zinc-300">{product.price}</p>
              <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                <span>{t("labels.seller")}</span>
                <span className="text-emerald-200 transition group-hover:text-emerald-100">
                  {t("labels.view")}
                </span>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
