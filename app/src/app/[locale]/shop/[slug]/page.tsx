import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { formatMoney } from "@/lib/format";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = useTranslations("Product");
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { seller: true },
  });

  if (!product) {
    notFound();
  }

  const typeLabel =
    product.type === "PREORDER" ? t("badge.preorder") : t("badge.dropship");
  const etaLabel =
    product.type === "PREORDER"
      ? t("badge.preorderEta", { days: product.preorderLeadDays ?? 14 })
      : t("badge.dropshipEta");
  const priceLabel = formatMoney(
    product.priceCents,
    product.currency,
    locale
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ardoBusiness
        </Link>
        <Link
          href="/cart"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("cart")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24 md:flex-row">
        <section className="flex-1 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/10 via-zinc-900 to-zinc-900 p-8">
          <div className="flex items-center gap-3 text-xs text-zinc-300">
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">
              {typeLabel}
            </span>
            <span>{etaLabel}</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold">{product.title}</h1>
          <p className="mt-3 text-sm text-zinc-300">
            {product.description ?? t("subtitle")}
          </p>
          <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>{t("details.price")}</span>
              <span className="text-base font-semibold text-emerald-200">
                {priceLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("details.seller")}</span>
              <span>{product.seller?.displayName ?? t("details.sellerValue")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("details.stock")}</span>
              <span>{t("details.stockValue")}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <AddToCartButton
              id={product.id}
              slug={product.slug}
              title={product.title}
              priceCents={product.priceCents}
              currency={product.currency}
              type={product.type}
              sellerName={product.seller?.displayName}
              label={t("cta.add")}
            />
            <button className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold">
              {t("cta.wishlist")}
            </button>
          </div>
        </section>

        <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <h2 className="text-xl font-semibold">{t("aside.title")}</h2>
          <p className="mt-3 text-sm text-zinc-300">{t("aside.desc")}</p>
          <div className="mt-6 grid gap-4 text-xs text-zinc-400">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <p className="text-sm font-semibold text-white">
                {t("aside.steps.0.title")}
              </p>
              <p className="mt-2">{t("aside.steps.0.desc")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <p className="text-sm font-semibold text-white">
                {t("aside.steps.1.title")}
              </p>
              <p className="mt-2">{t("aside.steps.1.desc")}</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
