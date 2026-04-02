/* eslint-disable @next/next/no-img-element */

import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";

type SearchParams = {
  country?: string;
  city?: string;
  verified?: string;
};

export default async function ImmoAgenciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);

  const country = (filters.country ?? "").trim().toUpperCase();
  const city = (filters.city ?? "").trim();
  const verifiedOnly = ["1", "true"].includes((filters.verified ?? "").trim().toLowerCase());

  const agencies = await prisma.immoPublisher.findMany({
    where: {
      type: "AGENCY",
      status: "ACTIVE",
      ...(country ? { country } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
      ...(verifiedOnly ? { verified: true } : {}),
    },
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      country: true,
      city: true,
      logoUrl: true,
      createdAt: true,
    },
  });

  const t = {
    title: locale === "fr" ? "Agences immobili?res" : "Real estate agencies",
    subtitle:
      locale === "fr"
        ? "D?couvre les agences actives et leurs annonces publi?es."
        : "Browse active agencies and their published listings.",
    back: locale === "fr" ? "Retour IMMO" : "Back to IMMO",
    verified: locale === "fr" ? "V?rifi?e" : "Verified",
    view: locale === "fr" ? "Voir le profil" : "View profile",
    empty: locale === "fr" ? "Aucune agence trouv?e." : "No agencies found.",
    city: locale === "fr" ? "Ville" : "City",
    country: locale === "fr" ? "Pays" : "Country",
    verifiedOnly: locale === "fr" ? "V?rifi?es" : "Verified only",
    filter: locale === "fr" ? "Filtrer" : "Filter",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-white">{t.title}</h1>
              <p className="mt-2 text-sm text-zinc-300">{t.subtitle}</p>
            </div>
            <Link href="/immo" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
              {t.back}
            </Link>
          </div>

          <form className="mt-4 grid gap-2 md:grid-cols-4">
            <input name="city" defaultValue={city} placeholder={t.city} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <input name="country" defaultValue={country} placeholder={t.country} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
            <select name="verified" defaultValue={verifiedOnly ? "true" : ""} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.verifiedOnly}</option>
              <option value="true">{t.verified}</option>
            </select>
            <button className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950">{t.filter}</button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agencies.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
              {t.empty}
            </div>
          ) : (
            agencies.map((agency) => (
              <article key={agency.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <div className="flex items-center gap-3">
                  {agency.logoUrl ? (
                    <img src={agency.logoUrl} alt={agency.name} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-sm font-semibold text-zinc-200">
                      {(agency.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-white">{agency.name}</h2>
                    <p className="text-xs text-zinc-400">{agency.city ?? "-"}, {agency.country ?? "-"}</p>
                  </div>
                </div>
                {agency.verified ? (
                  <span className="mt-3 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-200">
                    {t.verified}
                  </span>
                ) : null}
                <div className="mt-4">
                  <Link href={`/immo/agences/${agency.slug}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
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
