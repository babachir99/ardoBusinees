import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import Footer from "@/components/layout/Footer";

import FavoriteButton from "@/components/favorites/FavoriteButton";

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations("Store");

  const store = await prisma.store.findUnique({
    where: { slug },
  });

  const seller = store
    ? null
    : await prisma.sellerProfile.findUnique({
        where: { slug },
        select: {
          id: true,
          displayName: true,
        },
      });

  if (!store && !seller) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
          <p className="text-sm text-zinc-300">{t("notFound")}</p>
          <Link
            href="/stores"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {t("back")}
          </Link>
        </div>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: store
      ? { storeId: store.id, isActive: true }
      : { sellerId: seller!.id, isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
    },
  });

  const pageType = store ? store.type : locale === "fr" ? "VENDEUR" : "SELLER";
  const pageName = store?.name ?? seller?.displayName ?? slug;
  const pageDescription =
    store?.description ??
    (seller
      ? locale === "fr"
        ? `Tous les produits actifs de ${seller.displayName}.`
        : `All active products from ${seller.displayName}.`
      : t("defaultDesc"));

  const now = new Date();
  const isBoosted = (product: (typeof products)[number]) =>
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > now);

  const sortedProducts = [...products].sort((a, b) => {
    const boostDiff = Number(isBoosted(b)) - Number(isBoosted(a));
    if (boostDiff !== 0) return boostDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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
        <div className="flex items-center gap-3">
          <Link
            href="/stores"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("stores")}
          </Link>
          <Link
            href="/shop"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("shop")}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-300/15 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
            {pageType}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{pageName}</h1>
          <p className="mt-3 text-sm text-zinc-300">{pageDescription}</p>
        </section>

        <section className="grid gap-6 md:grid-cols-2 fade-up">
          {sortedProducts.map((product) => {
            const boosted = isBoosted(product);
            return (
              <Link
                key={product.id}
                href={`/shop/${product.slug}`}
                className={`rounded-3xl border bg-zinc-900/70 p-6 transition ${
                  boosted
                    ? "border-emerald-300/60 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                    : "border-white/10 hover:border-emerald-300/60"
                }`}
              >
                <div className="relative mb-4 h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
                  <FavoriteButton
                    productId={product.id}
                    variant="icon"
                    className="absolute left-3 top-3 z-20"
                  />
                  {product.images[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt ?? product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                      {locale === "fr" ? "Image a venir" : "Image coming soon"}
                    </div>
                  )}
                  {boosted && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] text-emerald-200">
                      {locale === "fr" ? "Booste" : "Boosted"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                    {product.type}
                  </span>
                  <span className="text-xs text-zinc-400">{t("view")}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold">{product.title}</h3>
                {product.discountPercent ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-emerald-200">
                      {formatMoney(
                        getDiscountedPrice(product.priceCents, product.discountPercent),
                        product.currency,
                        locale
                      )}
                    </span>
                    <span className="text-xs text-zinc-500 line-through">
                      {formatMoney(product.priceCents, product.currency, locale)}
                    </span>
                    <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                      -{product.discountPercent}%
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-300">
                    {formatMoney(product.priceCents, product.currency, locale)}
                  </p>
                )}
              </Link>
            );
          })}
          {products.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-sm text-zinc-300">
              {t("empty")}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
