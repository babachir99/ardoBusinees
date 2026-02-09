import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import AddToCartButton from "@/components/cart/AddToCartButton";
import CartBadge from "@/components/cart/CartBadge";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const session = await getServerSession(authOptions);
  const t = await getTranslations("Product");
  const normalizedSlug = slugify(slug);
  const slugCandidates =
    normalizedSlug && normalizedSlug !== slug ? [slug, normalizedSlug] : [slug];

  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: slugCandidates.map((candidate) => ({ slug: candidate })),
    },
    include: { seller: true },
  });

  if (!product) {
    notFound();
  }

  if (product.slug !== slug) {
    redirect(`/${locale}/shop/${product.slug}`);
  }

  const typeLabel =
    product.type === "PREORDER"
      ? t("badge.preorder")
      : product.type === "LOCAL"
      ? t("badge.local")
      : t("badge.dropship");
  const etaLabel =
    product.type === "PREORDER"
      ? t("badge.preorderEta", { days: product.preorderLeadDays ?? 14 })
      : product.type === "LOCAL"
      ? t("badge.localEta")
      : t("badge.dropshipEta");
  const priceLabel = formatMoney(
    product.priceCents,
    product.currency,
    locale
  );
  const discountedCents = getDiscountedPrice(
    product.priceCents,
    product.discountPercent
  );
  const hasDiscount =
    product.discountPercent !== null &&
    product.discountPercent !== undefined &&
    product.discountPercent > 0;
  const discountedLabel = formatMoney(
    discountedCents,
    product.currency,
    locale
  );
  const boosted =
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > new Date());

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
          {session?.user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/70"
            >
              Admin
            </Link>
          )}
          <Link
            href={session ? "/profile" : "/login"}
            className="flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
          >
            {session?.user?.image ? (
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-zinc-950/20 text-[10px] font-semibold text-white">
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "Profil"}
                  className="h-full w-full object-cover"
                />
              </span>
            ) : session?.user?.name ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/20 text-[10px] font-semibold text-white">
                {session.user.name.slice(0, 1).toUpperCase()}
              </span>
            ) : null}
            {session ? "Profil" : "Se connecter / S'inscrire"}
          </Link>
          <Link
            href="/cart"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {t("cart")}
            <CartBadge />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24 md:flex-row">
        <section className="flex-1 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/10 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">
              {typeLabel}
            </span>
            <span>{etaLabel}</span>
            {boosted && (
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">
                {locale === "fr" ? "Booste" : "Boosted"}
              </span>
            )}
          </div>
          <h1 className="mt-6 text-3xl font-semibold">{product.title}</h1>
          <p className="mt-3 text-sm text-zinc-300">
            {product.description ?? t("subtitle")}
          </p>
          <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>{t("details.price")}</span>
              {hasDiscount ? (
                <span className="flex items-center gap-2 text-base font-semibold text-emerald-200">
                  {discountedLabel}
                  <span className="text-xs text-zinc-500 line-through">
                    {priceLabel}
                  </span>
                  <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-200">
                    -{product.discountPercent}%
                  </span>
                </span>
              ) : (
                <span className="text-base font-semibold text-emerald-200">
                  {priceLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>{t("details.seller")}</span>
              <span>{product.seller?.displayName ?? t("details.sellerValue")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("details.stock")}</span>
              <span>
                {product.type === "LOCAL" && product.stockQuantity !== null
                  ? t("details.stockLocal", {
                      count: product.stockQuantity ?? 0,
                    })
                  : t("details.stockValue")}
              </span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <AddToCartButton
              id={product.id}
              slug={product.slug}
              title={product.title}
              priceCents={hasDiscount ? discountedCents : product.priceCents}
              currency={product.currency}
              type={product.type}
              sellerName={product.seller?.displayName}
              label={t("cta.add")}
              addedLabel={t("cta.added")}
            />
            <FavoriteButton productId={product.id} />
          </div>
        </section>

        <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/70 p-8 fade-up">
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
      <Footer />
    </div>
  );
}

