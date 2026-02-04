import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import Footer from "@/components/layout/Footer";

export default async function ShopPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ type?: string; category?: string; store?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const [{ type, category, store }, { locale }] = await Promise.all([
    searchParams,
    params,
  ]);
  const t = await getTranslations("Shop");

  const normalizedType = type?.toUpperCase();
  const activeCategory = category ?? undefined;
  const activeStore = store ?? undefined;
  const where =
    normalizedType === "PREORDER" ||
    normalizedType === "DROPSHIP" ||
    normalizedType === "LOCAL"
      ? { type: normalizedType, isActive: true }
      : { isActive: true };

  if (activeCategory) {
    where.categories = { some: { category: { slug: activeCategory } } };
  }
  if (activeStore) {
    where.store = { slug: activeStore };
  }

  const [products, categories, stores] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        seller: { select: { displayName: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
          <div className="flex items-center gap-3 text-xs text-zinc-300">
            <Link
              href="/shop"
              className={`rounded-full border px-3 py-1 ${
                !normalizedType
                  ? "border-emerald-300/60 text-emerald-200"
                  : "border-white/15"
              }`}
            >
              {t("filters.all")}
            </Link>
            <Link
              href="/shop?type=PREORDER"
              className={`rounded-full border px-3 py-1 ${
                normalizedType === "PREORDER"
                  ? "border-emerald-300/60 text-emerald-200"
                  : "border-white/15"
              }`}
            >
              {t("filters.preorder")}
            </Link>
            <Link
              href="/shop?type=DROPSHIP"
              className={`rounded-full border px-3 py-1 ${
                normalizedType === "DROPSHIP"
                  ? "border-emerald-300/60 text-emerald-200"
                  : "border-white/15"
              }`}
            >
              {t("filters.dropship")}
            </Link>
          </div>
        <Link
          href="/cart"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("cart")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
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
                {products.length}
              </span>
              <span>{t("hero.metrics.note")}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 fade-up">
          <Link
            href="/shop"
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              !normalizedType
                ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.all")}
          </Link>
          <Link
            href="/stores"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/40"
          >
            {t("filters.storesLink")}
          </Link>
          <Link
            href="/shop?type=PREORDER"
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              normalizedType === "PREORDER"
                ? "border-amber-300/60 bg-amber-300/10 text-amber-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.preorder")}
          </Link>
          <Link
            href="/shop?type=DROPSHIP"
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              normalizedType === "DROPSHIP"
                ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.dropship")}
          </Link>
          <Link
            href="/shop?type=LOCAL"
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              normalizedType === "LOCAL"
                ? "border-sky-300/60 bg-sky-300/10 text-sky-100"
                : "border-white/15 text-zinc-300 hover:border-white/40"
            }`}
          >
            {t("filters.local")}
          </Link>
        </section>

        <section className="flex flex-wrap items-center gap-3 fade-up">
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            {t("filters.categories")}
          </span>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/shop?category=${cat.slug}`}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeCategory === cat.slug
                  ? "border-sky-300/60 bg-sky-300/10 text-sky-100"
                  : "border-white/15 text-zinc-300 hover:border-white/40"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </section>

        <section className="flex flex-wrap items-center gap-3 fade-up">
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            {t("filters.stores")}
          </span>
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/shop?store=${s.slug}`}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeStore === s.slug
                  ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                  : "border-white/15 text-zinc-300 hover:border-white/40"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2 fade-up">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              className="group rounded-3xl border border-white/10 bg-zinc-900/70 p-6 transition hover:border-emerald-300/60"
            >
              <div className="mb-4 h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
                {product.images[0] ? (
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].alt ?? product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                    Image a venir
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    product.type === "PREORDER"
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-emerald-400/20 text-emerald-200"
                  }`}
                >
                  {product.type === "PREORDER"
                    ? t("labels.preorder")
                    : product.type === "LOCAL"
                    ? t("labels.local")
                    : t("labels.dropship")}
                </span>
                <span className="text-xs text-zinc-400">
                  {product.type === "PREORDER"
                    ? t("labels.eta", {
                        days: `${product.preorderLeadDays ?? 14} jours`,
                      })
                    : product.type === "LOCAL"
                    ? t("labels.localEta")
                    : t("labels.eta", { days: "5-10 jours" })}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">{product.title}</h3>
              <p className="mt-2 text-sm text-zinc-300">
                {formatMoney(product.priceCents, product.currency, locale)}
              </p>
              <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {product.seller?.displayName ?? t("labels.seller")}
                </span>
                <span className="text-emerald-200 transition group-hover:text-emerald-100">
                  {t("labels.view")}
                </span>
              </div>
            </Link>
          ))}
        </section>

        {products.length === 0 && (
          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-10 text-center fade-up">
            <p className="text-sm text-zinc-300">{t("empty")}</p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
