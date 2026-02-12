import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import Footer from "@/components/layout/Footer";
import SearchBar from "@/components/search/SearchBar";
import UserHeaderActions from "@/components/layout/UserHeaderActions";
import ProductCardCarousel from "@/components/shop/ProductCardCarousel";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const storeLogos: Record<string, string> = {
  "jontaado-immo": "/stores/immo.png",
  "jontaado-cars": "/stores/cars.png",
  "jontaado-presta": "/stores/presta.png",
  "jontaado-gp": "/stores/gp.png",
  "jontaado-tiak-tiak": "/stores/tiak.png",
};

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const [{ locale }, { q, category, sort }] = await Promise.all([
    params,
    searchParams,
  ]);
  const query = q?.trim();

  const session = await getServerSession(authOptions);
  const operatorProfile = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          role: true,
          sellerProfile: { select: { id: true } },
          kycSubmissions: {
            where: {
              status: "APPROVED",
              targetRole: { in: ["SELLER", "TRANSPORTER", "COURIER"] },
            },
            select: { id: true },
            take: 1,
          },
        },
      })
    : null;

  const hasOperatorProfile =
    Boolean(operatorProfile?.sellerProfile) ||
    Boolean(operatorProfile?.kycSubmissions?.length) ||
    operatorProfile?.role === "SELLER" ||
    operatorProfile?.role === "COURIER" ||
    operatorProfile?.role === "TRANSPORTER";

  const firstName = operatorProfile?.name?.trim().split(/\s+/)[0] ?? "";
  const operatorGreeting =
    locale === "fr"
      ? `Ravis de vous retrouver${firstName ? `, ${firstName}` : ""}`
      : `Welcome back${firstName ? `, ${firstName}` : ""}`;
  const operatorCta =
    locale === "fr" ? "Aller a votre espace" : "Go to your workspace";
  const startOperatorCta =
    locale === "fr"
      ? "Ouvrez votre espace vendeur / livreur / GP"
      : "Open your seller / courier / GP space";
  const loginToStartCta =
    locale === "fr" ? "Se connecter pour commencer" : "Sign in to get started";

  const operatorSpaceHref =
    operatorProfile?.sellerProfile || operatorProfile?.role === "SELLER"
      ? "/seller"
      : "/profile";
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "price_asc"
      ? { priceCents: "asc" }
      : sort === "price_desc"
      ? { priceCents: "desc" }
      : { createdAt: "desc" };

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category
        ? {
            categories: {
              some: {
                category: {
                  OR: [{ slug: category }, { parent: { slug: category } }],
                },
              },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { seller: { displayName: { contains: query, mode: "insensitive" } } },
              {
                categories: {
                  some: { category: { name: { contains: query, mode: "insensitive" } } },
                },
              },
              { store: { name: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy,
    take: 24,
    include: {
      seller: { select: { displayName: true } },
      images: { orderBy: { position: "asc" }, take: 5 },
    },
  });

  const now = new Date();
  const isBoosted = (product: typeof products[number]) =>
    product.boostStatus === "APPROVED" &&
    (!product.boostedUntil || new Date(product.boostedUntil) > now);

  const sortedProducts = [...products].sort((a, b) => {
    const boostDiff = Number(isBoosted(b)) - Number(isBoosted(a));
    if (boostDiff !== 0) return boostDiff;
    if (sort === "price_asc") return a.priceCents - b.priceCents;
    if (sort === "price_desc") return b.priceCents - a.priceCents;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const displayedProducts = sortedProducts.slice(0, 12);

  const [stores, categories, suggestions, sellerHints, storeHints, sidebarRootCategories] =
    await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { title: true },
    }),
    prisma.sellerProfile.findMany({
      orderBy: { displayName: "asc" },
      take: 6,
      select: { displayName: true },
    }),
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 6,
      select: { name: true },
    }),
    prisma.category.findMany({
      where: {
        isActive: true,
        parentId: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        children: {
          where: {
            isActive: true,
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const orderedSidebarRoots = [...sidebarRootCategories].sort((a, b) =>
    a.name.localeCompare(b.name, locale)
  );


  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 fade-up xl:flex-row xl:items-center xl:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[90px] w-auto md:h-[108px]"
            priority
          />
        </Link>
        <div className="w-full xl:max-w-[560px] xl:flex-1 xl:px-6">
          <SearchBar
            initialQuery={query}
            initialCategory={category}
            initialSort={sort}
            categories={categories}
            suggestions={[
              ...suggestions.map((item) => item.title),
              ...sellerHints.map((item) => item.displayName),
              ...storeHints.map((item) => item.name),
            ]}
          />
        </div>
        <UserHeaderActions
          locale={locale}
          showSellerLink
          className="flex items-center gap-2 text-sm xl:shrink-0"
        />
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pb-24 md:grid-cols-[190px_1fr] lg:grid-cols-[190px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-4 fade-up">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300">
            Categories
          </div>
          <div className="mt-2.5 space-y-1.5">
            {orderedSidebarRoots.map((root) => {
              const isActiveRoot =
                category === root.slug ||
                root.children.some((child) => child.slug === category);

              if (root.children.length === 0) {
                return (
                  <Link
                    key={root.id}
                    href={`/shop?category=${root.slug}`}
                    className={`block rounded-lg px-2.5 py-1 text-[11px] transition ${
                      isActiveRoot
                        ? "bg-emerald-300/10 text-emerald-100"
                        : "text-zinc-200 hover:bg-zinc-950/40 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{root.name}</span>
                  </Link>
                );
              }

              return (
                <details key={root.id} className="border-b border-white/10 pb-1">
                  <summary
                    className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] transition marker:content-[''] ${
                      isActiveRoot
                        ? "text-emerald-100"
                        : "text-zinc-200 hover:bg-zinc-950/40 hover:text-white"
                    }`}
                  >
                    <Link
                      href={`/shop?category=${root.slug}`}
                      className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                    >
                      {root.name}
                    </Link>
                    <span className="shrink-0 text-[10px] text-zinc-500">v</span>
                  </summary>
                  <div className="mt-1 space-y-1 pl-3">
                    {root.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/shop?category=${child.slug}`}
                        className={`block rounded-md px-2 py-1 text-[10px] transition ${
                          category === child.slug
                            ? "bg-emerald-300/10 text-emerald-100"
                            : "text-zinc-300 hover:bg-zinc-950/40 hover:text-white"
                        }`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          <Link
            href="/shop"
            className="mt-4 block rounded-full bg-emerald-400 px-4 py-1.5 text-center text-xs font-semibold text-zinc-950"
          >
            Voir tout
          </Link>
        </aside>

        <section className="flex flex-col gap-8">
          <div className="-mt-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-[2.2px] card-glow fade-up">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {stores.map((store) => (
                <Link
                  key={store.id}
                  href={`/stores/${store.slug}`}
                  className="flex flex-col items-center gap-0.5 rounded-2xl border border-transparent bg-transparent px-1 py-1 text-center text-xs text-zinc-200 transition hover:border-emerald-300/40"
                >
                  <Image
                    src={storeLogos[store.slug] ?? "/logo.png"}
                    alt={`${store.name} logo`}
                    width={252}
                    height={252}
                    className="h-[106px] w-[165px] object-contain"
                  />
                  <span className="sr-only">{store.name}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="-mt-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-[2.2px] card-glow fade-up">
            {session ? (
              hasOperatorProfile ? (
                <Link
                  href={operatorSpaceHref}
                  className="group flex w-full items-center justify-between rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-[0_10px_24px_rgba(16,185,129,0.16)]"
                >
                  <span className="text-sm font-semibold text-white">{operatorGreeting}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                    {operatorCta}<span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">â†’</span>
                  </span>
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="group flex w-full items-center justify-between rounded-2xl border border-white/15 bg-zinc-950/50 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                >
                  <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-emerald-200 bg-[length:200%_100%] bg-[position:0%_50%] bg-clip-text text-sm font-semibold text-transparent transition-[background-position,letter-spacing] duration-500 group-hover:bg-[position:100%_50%] group-hover:tracking-[0.01em]">{startOperatorCta}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
                    {operatorCta}<span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">â†’</span>
                  </span>
                </Link>
              )
            ) : (
              <Link
                href="/login"
                className="group flex w-full items-center justify-between rounded-2xl border border-white/15 bg-zinc-950/50 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
              >
                <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-emerald-200 bg-[length:200%_100%] bg-[position:0%_50%] bg-clip-text text-sm font-semibold text-transparent transition-[background-position,letter-spacing] duration-500 group-hover:bg-[position:100%_50%] group-hover:tracking-[0.01em]">{startOperatorCta}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  {loginToStartCta}<span className="text-sm transition-transform duration-200 group-hover:translate-x-0.5">â†’</span>
                </span>
              </Link>
            )}
          </div>
          <div className="fade-up">
            <h2 className="text-2xl font-semibold">
              {query ? `Resultats pour "${query}"` : "Produits disponibles"}
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              {query
                ? `${displayedProducts.length} resultat(s) trouve(s).`
                : "Les offres les plus recentes dans toutes les categories."}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 fade-up">
            {displayedProducts.map((product) => {
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
                    <span className="absolute right-4 top-4 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] text-emerald-200">
                      {locale === "fr" ? "Booste" : "Boosted"}
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
                        getDiscountedPrice(
                          product.priceCents,
                          product.discountPercent
                        ),
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
            )})}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

