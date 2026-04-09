/* eslint-disable @next/next/no-img-element */

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { hasUserRole } from "@/lib/userRoles";
import { buildImmoStoreHref } from "@/lib/immoStorefront";

export default async function ImmoListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const [{ locale, id }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);

  const listing = await prisma.immoListing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      listingType: true,
      propertyType: true,
      priceCents: true,
      currency: true,
      surfaceM2: true,
      rooms: true,
      city: true,
      country: true,
      imageUrls: true,
      status: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  if (!listing) {
    notFound();
  }

  const isAdmin = hasUserRole(session?.user, "ADMIN");
  const isOwner = session?.user?.id === listing.ownerId;

  if (listing.status !== "PUBLISHED" && !isOwner && !isAdmin) {
    notFound();
  }

  const t = {
    back: locale === "fr" ? "Retour aux annonces" : "Back to listings",
    contact: locale === "fr" ? "Contacter" : "Contact",
    contactHint:
      locale === "fr"
        ? "Contact via messagerie interne (coming soon)."
        : "Contact via internal messaging (coming soon).",
    owner: locale === "fr" ? "Annonceur" : "Owner",
    rooms: locale === "fr" ? "pieces" : "rooms",
    photos: locale === "fr" ? "Photos" : "Photos",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-4xl">
        <Link href={buildImmoStoreHref(locale, { tab: "explore" })} className="inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
          {t.back}
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <p className="text-xs text-zinc-400">{listing.listingType} - {listing.propertyType}</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{listing.title}</h1>
          <p className="mt-3 text-lg font-semibold text-emerald-200">
            {formatMoney(listing.priceCents, listing.currency, locale)}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {listing.surfaceM2} m2 - {listing.rooms ?? "-"} {t.rooms} - {listing.city}, {listing.country}
          </p>
          {listing.imageUrls.length > 0 ? (
            <div className="mt-5 space-y-3">
              <img
                src={listing.imageUrls[0]}
                alt={listing.title}
                className="h-72 w-full rounded-2xl border border-white/10 object-cover"
              />
              {listing.imageUrls.length > 1 ? (
                <div className="grid grid-cols-3 gap-2">
                  {listing.imageUrls.slice(1, 4).map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt={t.photos}
                      className="h-24 w-full rounded-xl border border-white/10 object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="mt-5 whitespace-pre-line text-sm text-zinc-200">{listing.description}</p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-xs text-zinc-400">{t.owner}</p>
            <p className="mt-1 text-sm text-zinc-200">{listing.owner.name ?? "JONTAADO"}</p>
            <button
              type="button"
              disabled
              className="mt-4 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white opacity-70"
            >
              {t.contact}
            </button>
            <p className="mt-2 text-xs text-zinc-500">{t.contactHint}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

