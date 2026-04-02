/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import GpTripReviewForm from "@/components/gp/GpTripReviewForm";
import UserSafetyActions from "@/components/trust/UserSafetyActions";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function formatDateOnly(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

export default async function TransporterProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession(authOptions);

  const [transporter, reviewStats, recentReviews, activeTrips, totalTrips, myBookings] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        phone: true,
        role: true,
        transporterRating: true,
        transporterReviewCount: true,
      },
    }),
    prisma.transporterReview.aggregate({
      where: { transporterId: id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.transporterReview.findMany({
      where: { transporterId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
        trip: {
          select: {
            id: true,
            originCity: true,
            destinationCity: true,
            flightDate: true,
          },
        },
      },
    }),
    prisma.gpTrip.findMany({
      where: { transporterId: id, isActive: true, status: "OPEN" },
      orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        originCity: true,
        destinationCity: true,
        originAddress: true,
        destinationAddress: true,
        flightDate: true,
        availableKg: true,
        pricePerKgCents: true,
        currency: true,
        acceptedPaymentMethods: true,
      },
    }),
    prisma.gpTrip.count({ where: { transporterId: id } }),
    session?.user?.id
      ? prisma.gpTripBooking.findMany({
          where: {
            customerId: session.user.id,
            transporterId: id,
          },
          select: { tripId: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  if (!transporter || transporter.role !== "TRANSPORTER") {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <div className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
          <p className="text-sm text-zinc-300">
            {locale === "fr" ? "Transporteur introuvable" : "Transporter not found"}
          </p>
          <Link
            href="/stores/jontaado-gp"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Retour a GP" : "Back to GP"}
          </Link>
        </div>
      </div>
    );
  }

  const average = reviewStats._avg.rating ?? transporter.transporterRating;
  const count = reviewStats._count._all || transporter.transporterReviewCount;
  const isOwner = session?.user?.id === transporter.id;

  const canReviewByTrip = new Set(
    myBookings
      .filter((booking) => booking.status === "DELIVERED" || booking.status === "COMPLETED")
      .map((booking) => booking.tripId)
  );

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
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
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/stores/jontaado-gp"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {locale === "fr" ? "Retour a GP" : "Back to GP"}
          </Link>
          {isOwner && (
            <Link
              href="/transporter"
              className="rounded-full border border-cyan-300/40 px-4 py-2 text-cyan-100 transition hover:border-cyan-300/80"
            >
              {locale === "fr" ? "Mon dashboard" : "My dashboard"}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-zinc-950/70">
                {transporter.image ? (
                  <img
                    src={transporter.image}
                    alt={transporter.name ?? "Transporter"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                    {(transporter.name ?? "T").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">JONTAADO GP</p>
                <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                  {transporter.name ?? (locale === "fr" ? "Transporteur" : "Transporter")}
                </h1>
                <p className="mt-2 text-sm text-zinc-300">
                  {locale === "fr"
                    ? "Profil public du transporteur et ses trajets actifs."
                    : "Public transporter profile and active trips."}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-right text-xs text-zinc-300">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                {locale === "fr" ? "Notation" : "Rating"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-200">* {average.toFixed(1)}</p>
              <p className="text-[11px] text-zinc-400">
                {count} {locale === "fr" ? "avis" : "reviews"}
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                {totalTrips} {locale === "fr" ? "trajets publies" : "published trips"}
              </p>
            </div>
          </div>
        </section>

        {session?.user?.id && !isOwner ? (
          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-4">
            <UserSafetyActions userId={transporter.id} locale={locale} />
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                {locale === "fr" ? "Trajets actifs" : "Active trips"}
              </h2>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-zinc-300">
                {activeTrips.length}
              </span>
            </div>

            {activeTrips.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {locale === "fr" ? "Aucun trajet actif." : "No active trips."}
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {activeTrips.map((trip) => (
                  <article
                    key={trip.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {trip.originCity} {"->"} {trip.destinationCity}
                      </p>
                      <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-[11px] text-cyan-100">
                        {trip.availableKg} kg
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {formatDateOnly(locale, trip.flightDate)} - {trip.pricePerKgCents} {trip.currency === "XOF" ? "FCFA" : trip.currency}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {trip.originAddress} {"->"} {trip.destinationAddress}
                    </p>
                    <details className="mt-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
                        {locale === "fr" ? "Avis" : "Reviews"}
                      </summary>
                      <GpTripReviewForm
                        tripId={trip.id}
                        locale={locale}
                        isLoggedIn={Boolean(session?.user?.id)}
                        isOwner={isOwner}
                        canReview={canReviewByTrip.has(trip.id)}
                        lockedMessage={
                          locale === "fr"
                            ? "Tu pourras noter apres reception du colis."
                            : "You can rate after package delivery."
                        }
                      />
                    </details>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">
              {locale === "fr" ? "Derniers avis" : "Latest reviews"}
            </h2>

            {recentReviews.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {locale === "fr" ? "Pas encore d'avis." : "No reviews yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {recentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-3 text-xs text-zinc-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-amber-200">* {review.rating}/5</p>
                      <p className="text-[11px] text-zinc-500">
                        {new Date(review.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {(review.reviewer.name ?? (locale === "fr" ? "Client" : "Customer"))} - {review.trip.originCity} {"->"} {review.trip.destinationCity}
                    </p>
                    {review.title && <p className="mt-2 font-semibold text-white">{review.title}</p>}
                    {review.comment && <p className="mt-1 text-zinc-300">{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
