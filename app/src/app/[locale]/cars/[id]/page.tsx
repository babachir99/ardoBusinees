/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { hasUserRole } from "@/lib/userRoles";
import CarsGpIntentSuggestion from "@/components/cars/CarsGpIntentSuggestion";
import { isEligibleForGP } from "@/lib/orchestratorEligibility";
import { buildCarsStoreHref } from "@/lib/carsStorefront";
import { buildStoreMetadata } from "@/lib/storeSeo";

const getCarListing = cache(async (id: string) => {
  return prisma.carListing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      imageUrls: true,
      priceCents: true,
      currency: true,
      country: true,
      city: true,
      make: true,
      model: true,
      year: true,
      mileageKm: true,
      fuelType: true,
      gearbox: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
          logoUrl: true,
        },
      },
    },
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const listing = await getCarListing(id);
  const isFr = locale === "fr";

  if (!listing) {
    return buildStoreMetadata({
      locale,
      path: `/cars/${id}`,
      title: isFr ? "Annonce CARS introuvable | JONTAADO" : "CARS listing not found | JONTAADO",
      description: isFr
        ? "Cette annonce CARS est introuvable ou n'est plus disponible."
        : "This CARS listing could not be found or is no longer available.",
      imagePath: "/stores/cars.png",
    });
  }

  const formattedPrice = formatMoney(listing.priceCents, listing.currency, locale);
  const title = isFr
    ? `${listing.title} | ${listing.make} ${listing.model} sur JONTAADO CARS`
    : `${listing.title} | ${listing.make} ${listing.model} on JONTAADO CARS`;
  const description = isFr
    ? `${listing.make} ${listing.model} ${listing.year}, ${listing.mileageKm.toLocaleString(locale)} km, ${formattedPrice}, ${listing.city}. ${listing.publisher?.name ? `Vendu par ${listing.publisher.name}.` : "Annonce particulier."}`
    : `${listing.make} ${listing.model} ${listing.year}, ${listing.mileageKm.toLocaleString(locale)} km, ${formattedPrice}, ${listing.city}. ${listing.publisher?.name ? `Sold by ${listing.publisher.name}.` : "Individual listing."}`;

  return buildStoreMetadata({
    locale,
    path: `/cars/${listing.id}`,
    title,
    description,
    imagePath: listing.imageUrls[0] || "/stores/cars.png",
  });
}

export default async function CarListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const [{ locale, id }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);

  const listing = await getCarListing(id);

  if (!listing) {
    notFound();
  }

  const isAdmin = hasUserRole(session?.user, "ADMIN");
  const isOwner = session?.user?.id === listing.ownerId;

  if (listing.status !== "PUBLISHED" && !isOwner && !isAdmin) {
    notFound();
  }

  const partsShippingHint = /(piece|pieces|part|parts|spare|engine|moteur|gearbox|boite)/i.test(
    `${listing.title} ${listing.description}`
  );
  const showGpSuggestion =
    listing.status === "PUBLISHED" &&
    isEligibleForGP({
      intentType: "TRANSPORT",
      objectType: partsShippingHint ? "PARTS" : "NONE",
      fromCountry: listing.country,
      fromCity: listing.city,
    }) &&
    (listing.country.toUpperCase() !== "SN" || partsShippingHint);

  const t = {
    back: locale === "fr" ? "Retour aux annonces" : "Back to listings",
    spec: locale === "fr" ? "Specifications" : "Specifications",
    city: locale === "fr" ? "Ville" : "City",
    country: locale === "fr" ? "Pays" : "Country",
    mileage: locale === "fr" ? "Kilometrage" : "Mileage",
    fuel: locale === "fr" ? "Carburant" : "Fuel",
    gearbox: locale === "fr" ? "Boite" : "Gearbox",
    year: locale === "fr" ? "Annee" : "Year",
    status: locale === "fr" ? "Statut" : "Status",
    dealer: locale === "fr" ? "Concessionnaire" : "Dealer",
    individual: locale === "fr" ? "Particulier" : "Individual",
    verified: locale === "fr" ? "Verifie" : "Verified",
    viewDealer: locale === "fr" ? "Voir la vitrine" : "View storefront",
    photos: locale === "fr" ? "Photos" : "Photos",
  };

  return (
    <div className="min-h-screen bg-jonta px-6 pb-24 pt-8 text-zinc-100">
      <main className="mx-auto w-full max-w-4xl">
        <Link
          href={buildCarsStoreHref(locale, { tab: "explore" })}
          className="inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white"
        >
          {t.back}
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <p className="text-xs text-zinc-400">{listing.make} {listing.model}</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{listing.title}</h1>
          <p className="mt-3 text-lg font-semibold text-cyan-200">
            {formatMoney(listing.priceCents, listing.currency, locale)}
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

          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-xs text-zinc-400">{t.dealer}</p>
            {listing.publisher ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-zinc-200">
                  {listing.publisher.name} {listing.publisher.verified ? `(${t.verified})` : ""}
                </p>
                <Link href={`/cars/dealers/${listing.publisher.slug}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                  {t.viewDealer}
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-200">{t.individual}</p>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-xs text-zinc-400">{t.spec}</p>
            <div className="mt-3 grid gap-2 text-sm text-zinc-200 md:grid-cols-2">
              <p>{t.year}: {listing.year}</p>
              <p>{t.mileage}: {listing.mileageKm.toLocaleString(locale)} km</p>
              <p>{t.fuel}: {listing.fuelType}</p>
              <p>{t.gearbox}: {listing.gearbox}</p>
              <p>{t.city}: {listing.city}</p>
              <p>{t.country}: {listing.country}</p>
              {isOwner || isAdmin ? <p>{t.status}: {listing.status}</p> : null}
            </div>
          </div>

          <p className="mt-5 whitespace-pre-line text-sm text-zinc-200">{listing.description}</p>

          {showGpSuggestion ? (
            <CarsGpIntentSuggestion
              locale={locale}
              listingId={listing.id}
              fromCountry={listing.country}
              fromCity={listing.city}
              objectType={partsShippingHint ? "PARTS" : "NONE"}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
