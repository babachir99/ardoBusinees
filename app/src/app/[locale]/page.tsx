import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import Footer from "@/components/layout/Footer";
import SearchBar from "@/components/search/SearchBar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOutIconButton from "@/components/auth/SignOutIconButton";

const sidebarCategories = [
  { label: "JONTAADO IMMO", href: "/stores/jontaado-immo" },
  { label: "JONTAADO CARS", href: "/stores/jontaado-cars" },
  { label: "JONTAADO PRESTA", href: "/stores/jontaado-presta" },
  { label: "JONTAADO GP", href: "/stores/jontaado-gp" },
  { label: "JONTAADO TIAK TIAK", href: "/stores/jontaado-tiak-tiak" },
  { label: "Vetements", href: "/shop?category=lifestyle" },
  { label: "Electronique", href: "/shop?category=tech" },
  { label: "Maison", href: "/shop?category=local" },
  { label: "Cosmetiques", href: "/shop?category=local" },
  { label: "Enfants", href: "/shop?category=local" },
  { label: "Services", href: "/stores/jontaado-presta" },
];

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
  const session = await getServerSession(authOptions);
  const t = await getTranslations("Home");
  const query = q?.trim();

  const orderBy =
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
              some: { category: { slug: category } },
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
      images: { orderBy: { position: "asc" }, take: 1 },
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

  const [stores, categories, suggestions, sellerHints, storeHints] =
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
  ]);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 fade-up lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
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
        <div className="w-full lg:max-w-[380px] lg:justify-self-center">
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
        <div className="flex flex-wrap items-center gap-2 text-sm lg:justify-self-end">
          {session?.user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/70"
            >
              Admin
            </Link>
          )}
          <Link href="/seller" className="text-zinc-300 hover:text-white">
            Vendre
          </Link>
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
          {session && <SignOutIconButton />}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pb-24 md:grid-cols-[190px_1fr] lg:grid-cols-[190px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-4 fade-up">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300">
            Categories
          </div>
          <div className="mt-2.5 grid gap-1.5 text-xs text-zinc-200">
            {sidebarCategories.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-300/60"
              >
                <span>{item.label}</span>
                <span className="text-zinc-500">›</span>
              </Link>
            ))}
          </div>
          <Link
            href="/shop"
            className="mt-4 block rounded-full bg-emerald-400 px-4 py-1.5 text-center text-xs font-semibold text-zinc-950"
          >
            Voir tout
          </Link>
        </aside>

        <section className="flex flex-col gap-8">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-3 card-glow fade-up">
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

          <div className="fade-up">
            <h2 className="text-2xl font-semibold">
              {query ? `Resultats pour "${query}"` : "Produits disponibles 🔥"}
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
