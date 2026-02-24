import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";

type SearchParams = {
  country?: string;
  city?: string;
  verified?: string;
  take?: string;
};

export default async function CarsDealersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);

  const country = filters.country?.trim().toUpperCase() || "";
  const city = filters.city?.trim() || "";
  const verified = ["1", "true"].includes((filters.verified ?? "").toLowerCase());
  const takeRaw = Number(filters.take ?? "40");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 80) : 40;

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    type: "DEALER",
  };

  if (country) where.country = country;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (verified) where.verified = true;

  const dealers = await prisma.carPublisher.findMany({
    where,
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      country: true,
      city: true,
      logoUrl: true,
      _count: {
        select: {
          listings: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
  });

  const t = {
    title: locale === "fr" ? "Concessionnaires voitures" : "Car dealers",
    subtitle:
      locale === "fr"
        ? "Trouvez des concessions actives et leurs annonces publiees."
        : "Find active dealerships and their published listings.",
    back: locale === "fr" ? "Retour voitures" : "Back to cars",
    country: locale === "fr" ? "Pays" : "Country",
    city: locale === "fr" ? "Ville" : "City",
    verified: locale === "fr" ? "Verifies seulement" : "Verified only",
    apply: locale === "fr" ? "Appliquer" : "Apply",
    view: locale === "fr" ? "Voir vitrine" : "View storefront",
    listings: locale === "fr" ? "annonces" : "listings",
    empty: locale === "fr" ? "Aucun concessionnaire trouve." : "No dealer found.",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-8">
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t.subtitle}</p>
          <div className="mt-4 flex gap-2">
            <Link href="/cars" className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
              {t.back}
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <form className="grid gap-2 md:grid-cols-4">
            <input name="country" defaultValue={filters.country ?? ""} placeholder={t.country} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="city" defaultValue={filters.city ?? ""} placeholder={t.city} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <select name="verified" defaultValue={verified ? "true" : ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.verified}</option>
              <option value="true">{t.verified}</option>
            </select>
            <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950">{t.apply}</button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {dealers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              {t.empty}
            </div>
          ) : (
            dealers.map((dealer) => (
              <article key={dealer.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <h2 className="text-lg font-semibold text-white">{dealer.name}</h2>
                <p className="mt-1 text-xs text-zinc-400">{dealer.city ?? "-"}, {dealer.country ?? "-"}</p>
                <p className="mt-1 text-xs text-zinc-500">{dealer._count.listings} {t.listings}</p>
                {dealer.verified ? (
                  <span className="mt-2 inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                    {t.verified}
                  </span>
                ) : null}
                <div className="mt-4">
                  <Link href={`/cars/dealers/${dealer.slug}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                    {t.view}
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
