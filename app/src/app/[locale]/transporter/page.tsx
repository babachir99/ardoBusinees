import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateOnly(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
}

export default async function TransporterDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !["TRANSPORTER", "ADMIN"].includes(session.user.role)) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {locale === "fr" ? "Acces transporteur requis" : "Transporter access required"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {locale === "fr"
                ? "Ce dashboard est reserve aux transporteurs GP."
                : "This dashboard is reserved for GP transporters."}
            </p>
            <Link
              href="/stores/jontaado-gp"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {locale === "fr" ? "Retour a GP" : "Back to GP"}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const [user, trips, recentReviews] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        transporterRating: true,
        transporterReviewCount: true,
      },
    }),
    prisma.gpTrip.findMany({
      where: { transporterId: session.user.id },
      orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        originCity: true,
        destinationCity: true,
        flightDate: true,
        availableKg: true,
        pricePerKgCents: true,
        currency: true,
        status: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.transporterReview.findMany({
      where: { transporterId: session.user.id },
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
  ]);

  if (!user) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <p className="text-sm text-zinc-300">{locale === "fr" ? "Profil introuvable" : "Profile not found"}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalTrips = trips.length;
  const openTrips = trips.filter((trip) => trip.status === "OPEN").length;
  const closedTrips = trips.filter((trip) => trip.status === "CLOSED").length;
  const canceledTrips = trips.filter((trip) => trip.status === "CANCELED").length;
  const totalKg = trips.filter((trip) => trip.status === "OPEN").reduce((acc, trip) => acc + trip.availableKg, 0);

  const pricedTrips = trips.filter((trip) => trip.status === "OPEN");
  const averagePrice =
    pricedTrips.length > 0
      ? Math.round(pricedTrips.reduce((acc, trip) => acc + trip.pricePerKgCents, 0) / pricedTrips.length)
      : 0;

  const nextTrip = trips
    .filter((trip) => trip.status === "OPEN" && trip.flightDate >= new Date())
    .sort((a, b) => a.flightDate.getTime() - b.flightDate.getTime())[0];

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
            {locale === "fr" ? "Voir GP" : "Go to GP"}
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            {locale === "fr" ? "Profil" : "Profile"}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">JONTAADO GP</p>
          <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
            {locale === "fr" ? "Dashboard transporteur" : "Transporter dashboard"}
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            {locale === "fr"
              ? `Ravis de vous retrouver ${user.name ?? ""}. Suivez vos trajets, avis et performances.`
              : `Welcome back ${user.name ?? ""}. Track your trips, reviews and performance.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-white/15 px-3 py-1">
              ? {user.transporterRating.toFixed(1)} ({user.transporterReviewCount})
            </span>
            {user.phone && (
              <span className="rounded-full border border-white/15 px-3 py-1">
                {locale === "fr" ? "Contact" : "Contact"}: {user.phone}
              </span>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: locale === "fr" ? "Trajets total" : "Total trips", value: totalTrips },
            { label: locale === "fr" ? "Ouverts" : "Open", value: openTrips },
            { label: locale === "fr" ? "Clotures" : "Closed", value: closedTrips },
            { label: locale === "fr" ? "Annules" : "Canceled", value: canceledTrips },
            { label: locale === "fr" ? "Kg ouverts" : "Open kg", value: totalKg },
            {
              label: locale === "fr" ? "Prix moyen (open)" : "Average price (open)",
              value: `${averagePrice} ${nextTrip?.currency === "XOF" ? "FCFA" : nextTrip?.currency ?? "XOF"}`,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
              <p className="text-[11px] text-zinc-400">{card.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                {locale === "fr" ? "Mes trajets GP" : "My GP trips"}
              </h2>
              <Link
                href="/stores/jontaado-gp"
                className="rounded-full border border-cyan-300/40 px-3 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-300/80"
              >
                {locale === "fr" ? "Publier / gerer" : "Publish / manage"}
              </Link>
            </div>

            {trips.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {locale === "fr" ? "Aucun trajet publie pour l'instant." : "No trips published yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-3 text-xs text-zinc-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {trip.originCity} {"->"} {trip.destinationCity}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                          trip.status === "OPEN"
                            ? "bg-emerald-400/20 text-emerald-200"
                            : trip.status === "CLOSED"
                            ? "bg-amber-400/20 text-amber-200"
                            : "bg-rose-400/20 text-rose-200"
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {formatDateOnly(locale, trip.flightDate)} - {trip.availableKg}kg - {trip.pricePerKgCents} {trip.currency === "XOF" ? "FCFA" : trip.currency}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">ID: {trip.id.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">
              {locale === "fr" ? "Avis recus" : "Received reviews"}
            </h2>
            {nextTrip && (
              <p className="mt-2 text-xs text-zinc-400">
                {locale === "fr" ? "Prochain depart" : "Next departure"}: {formatDateOnly(locale, nextTrip.flightDate)}
              </p>
            )}

            {recentReviews.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">
                {locale === "fr" ? "Aucun avis pour le moment." : "No reviews yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {recentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-3 text-xs text-zinc-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-amber-200">? {review.rating}/5</p>
                      <p className="text-[11px] text-zinc-500">
                        {new Date(review.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {review.reviewer.name ?? (locale === "fr" ? "Client" : "Customer")} - {review.trip.originCity} {"->"} {review.trip.destinationCity}
                    </p>
                    {review.comment && <p className="mt-1">{review.comment}</p>}
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
