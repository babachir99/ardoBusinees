import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import ProductCardCarousel from "@/components/shop/ProductCardCarousel";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type VerticalStorefrontProps = {
  locale: string;
  storeSlug: string;
  categoryFilter?: string;
  backLabel: string;
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    features: string[];
  };
  role: {
    target: "COURIER" | "TRANSPORTER";
    ctaActive: string;
    ctaInactive: string;
  };
  theme: {
    gradientFromClass: string;
    kickerClass: string;
    accentClass: string;
  };
};

type StoreCategoryOption = {
  slug: string;
  label: string;
};

function normalizeCategoryFilter(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildCategoryOptions(
  rows: Array<{
    category: {
      slug: string;
      name: string;
      parent: { name: string } | null;
    };
  }>
): StoreCategoryOption[] {
  const unique = new Map<string, StoreCategoryOption>();

  for (const row of rows) {
    const slug = row.category.slug;
    if (!slug || unique.has(slug)) continue;

    const label = row.category.parent
      ? `${row.category.parent.name} > ${row.category.name}`
      : row.category.name;

    unique.set(slug, { slug, label });
  }

  return Array.from(unique.values());
}

export default async function VerticalStorefront({
  locale,
  storeSlug,
  categoryFilter,
  backLabel,
  hero,
  role,
  theme,
}: VerticalStorefrontProps) {
  const [session, store] = await Promise.all([
    getServerSession(authOptions),
    prisma.store.findUnique({
      where: { slug: storeSlug },
      select: {
        id: true,
        name: true,
        description: true,
      },
    }),
  ]);

  if (!store) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
          <p className="text-sm text-zinc-300">
            {locale === "fr" ? "Boutique introuvable" : "Store not found"}
          </p>
          <Link
            href="/stores"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Retour aux boutiques" : "Back to stores"}
          </Link>
        </div>
      </div>
    );
  }

  const normalizedCategory = normalizeCategoryFilter(categoryFilter);

  const storeProductWhere = {
    storeId: store.id,
    isActive: true,
  } as const;

  const productWhere = normalizedCategory
    ? {
        ...storeProductWhere,
        categories: {
          some: {
            category: {
              OR: [{ slug: normalizedCategory }, { parent: { slug: normalizedCategory } }],
            },
          },
        },
      }
    : storeProductWhere;

  const [products, totalProductsCount, activeSellerRows, storeCategoryRows] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { position: "asc" }, take: 5 },
        seller: { select: { displayName: true } },
      },
    }),
    prisma.product.count({ where: storeProductWhere }),
    prisma.product.findMany({
      where: storeProductWhere,
      distinct: ["sellerId"],
      select: { sellerId: true },
    }),
    prisma.storeCategory.findMany({
      where: {
        storeId: store.id,
        category: { isActive: true },
      },
      select: {
        category: {
          select: {
            slug: true,
            name: true,
            parent: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: {
        category: {
          name: "asc",
        },
      },
    }),
  ]);

  const categoryOptions = buildCategoryOptions(storeCategoryRows);

  const now = new Date();
  const isBoosted = (product: (typeof products)[number]) =>
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > now);

  const sortedProducts = [...products].sort((a, b) => {
    const boostDiff = Number(isBoosted(b)) - Number(isBoosted(a));
    if (boostDiff !== 0) return boostDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const hasTargetRole = session?.user?.role === role.target;
  const roleHelperText = hasTargetRole
    ? locale === "fr"
      ? "Vous etes deja valide sur cet espace."
      : "Your account is already validated for this space."
    : locale === "fr"
    ? "Completer votre profil/KYC pour accepter des missions."
    : "Complete your profile/KYC to start accepting tasks.";

  const currentStorePath = `/stores/${storeSlug}`;

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
          href="/stores"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {backLabel}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24">
        <section
          className={`rounded-3xl border border-white/10 bg-gradient-to-br ${theme.gradientFromClass} via-zinc-900 to-zinc-900 p-8 card-glow fade-up`}
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${theme.kickerClass}`}>
            {hero.kicker}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{hero.title}</h1>
          <p className="mt-3 text-sm text-zinc-300">{hero.subtitle}</p>

          {hero.features.length > 0 && (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {hero.features.map((feature) => (
                <div
                  key={feature}
                  className="rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-200"
                >
                  {feature}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3 fade-up">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Offres actives" : "Active offers"}
            </p>
            <p className={`mt-2 text-xl font-semibold ${theme.accentClass}`}>{totalProductsCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Vendeurs actifs" : "Active sellers"}
            </p>
            <p className={`mt-2 text-xl font-semibold ${theme.accentClass}`}>{activeSellerRows.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Categories" : "Categories"}
            </p>
            <p className={`mt-2 text-xl font-semibold ${theme.accentClass}`}>{categoryOptions.length}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={currentStorePath}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                !normalizedCategory
                  ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 text-zinc-300 hover:border-white/20"
              }`}
            >
              {locale === "fr" ? "Toutes les categories" : "All categories"}
            </Link>
            {categoryOptions.map((category) => {
              const active = normalizedCategory === category.slug;
              return (
                <Link
                  key={category.slug}
                  href={`${currentStorePath}?category=${encodeURIComponent(category.slug)}`}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
                      : "border-white/10 text-zinc-300 hover:border-white/20"
                  }`}
                >
                  {category.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{store.name}</p>
              <p className="mt-1 text-xs text-zinc-400">{roleHelperText}</p>
            </div>
            <Link
              href="/profile"
              className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
            >
              {hasTargetRole ? role.ctaActive : role.ctaInactive}
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 fade-up">
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
                  <ProductCardCarousel
                    images={product.images}
                    title={product.title}
                    locale={locale}
                  />
                  {boosted && (
                    <span
                      className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-400/20 text-orange-200"
                      title={locale === "fr" ? "Produit booste" : "Boosted product"}
                      aria-label={locale === "fr" ? "Produit booste" : "Boosted product"}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M11.2 1.9L4.5 10h3.9l-1 8.1L15.5 9h-4l-.3-7.1z" />
                      </svg>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{product.type}</span>
                  <span>{product.seller?.displayName ?? "JONTAADO"}</span>
                </div>

                <h3 className="mt-3 text-lg font-semibold">{product.title}</h3>

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

          {sortedProducts.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
              {locale === "fr"
                ? "Aucune offre active pour ce filtre pour le moment."
                : "No active offers for this filter yet."}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
