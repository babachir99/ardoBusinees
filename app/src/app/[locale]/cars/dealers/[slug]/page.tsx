import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

export default async function CarDealerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const dealer = await prisma.carPublisher.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      type: "DEALER",
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
      updatedAt: true,
      _count: {
        select: {
          listings: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
  });

  if (!dealer) {
    notFound();
  }

  const listings = await prisma.carListing.findMany({
    where: {
      publisherId: dealer.id,
      status: "PUBLISHED",
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      currency: true,
      city: true,
      country: true,
      make: true,
      model: true,
      year: true,
      mileageKm: true,
      createdAt: true,
    },
  });

  const t = {
    back: locale === "fr" ? "Retour concessionnaires" : "Back to dealers",
    title: locale === "fr" ? "Vitrine concessionnaire" : "Dealer storefront",
    verified: locale === "fr" ? "Verifie" : "Verified",
    listings: locale === "fr" ? "Annonces publiees" : "Published listings",
    view: locale === "fr" ? "Voir" : "View",
    km: locale === "fr" ? "km" : "km",
    empty: locale === "fr" ? "Aucune annonce publiee." : "No published listing.",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-8">
          <Link href="/cars/dealers" className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
            {t.back}
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-400">{t.title}</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{dealer.name}</h1>
          <p className="mt-1 text-sm text-zinc-300">{dealer.city ?? "-"}, {dealer.country ?? "-"}</p>
          {dealer.verified ? (
            <span className="mt-2 inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
              {t.verified}
            </span>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">{dealer._count.listings} {t.listings.toLowerCase()}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300 md:col-span-2 xl:col-span-3">
              {t.empty}
            </div>
          ) : (
            listings.map((listing) => (
              <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <p className="text-xs text-zinc-400">{listing.make} {listing.model}</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{listing.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{listing.description}</p>
                <p className="mt-3 text-sm text-cyan-200">{formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.year} - {listing.mileageKm.toLocaleString(locale)} {t.km}</p>
                <p className="mt-1 text-xs text-zinc-400">{listing.city}, {listing.country}</p>
                <div className="mt-4">
                  <Link href={`/cars/${listing.id}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
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
