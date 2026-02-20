import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

export default async function ImmoAgencyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const publisher = await prisma.immoPublisher.findFirst({
    where: {
      slug,
      type: "AGENCY",
      status: "ACTIVE",
    },
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

  if (!publisher) {
    notFound();
  }

  const [publishedCount, listings] = await Promise.all([
    prisma.immoListing.count({
      where: {
        publisherId: publisher.id,
        status: "PUBLISHED",
      },
    }),
    prisma.immoListing.findMany({
      where: {
        publisherId: publisher.id,
        status: "PUBLISHED",
      },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        listingType: true,
        propertyType: true,
        priceCents: true,
        currency: true,
        surfaceM2: true,
        rooms: true,
        city: true,
        country: true,
        createdAt: true,
      },
    }),
  ]);

  const t = {
    back: locale === "fr" ? "Retour agences" : "Back to agencies",
    listings: locale === "fr" ? "Annonces publi?es" : "Published listings",
    verified: locale === "fr" ? "V?rifi?e" : "Verified",
    empty: locale === "fr" ? "Aucune annonce publi?e." : "No published listings.",
    view: locale === "fr" ? "Voir annonce" : "View listing",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link href="/immo/agences" className="inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
          {t.back}
        </Link>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <div className="flex items-center gap-4">
            {publisher.logoUrl ? (
              <img src={publisher.logoUrl} alt={publisher.name} className="h-16 w-16 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-lg font-semibold text-zinc-200">
                {(publisher.name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-semibold text-white">{publisher.name}</h1>
              <p className="mt-1 text-sm text-zinc-300">{publisher.city ?? "-"}, {publisher.country ?? "-"}</p>
              {publisher.verified ? (
                <span className="mt-2 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-200">
                  {t.verified}
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-400">{t.listings}: {publishedCount}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2">
              {t.empty}
            </div>
          ) : (
            listings.map((listing) => (
              <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <p className="text-xs text-zinc-400">{listing.listingType} - {listing.propertyType}</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{listing.title}</h2>
                <p className="mt-2 text-sm text-emerald-200">{formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.surfaceM2} m2 - {listing.rooms ?? "-"} rooms</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.city}, {listing.country}</p>
                <div className="mt-3">
                  <Link href={`/immo/${listing.id}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
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
