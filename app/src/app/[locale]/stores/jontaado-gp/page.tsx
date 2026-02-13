import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import GpTripPublisher from "@/components/gp/GpTripPublisher";

const paymentMethodLabels: Record<string, { fr: string; en: string }> = {
  WAVE: { fr: "Wave", en: "Wave" },
  ORANGE_MONEY: { fr: "Orange Money", en: "Orange Money" },
  CARD: { fr: "Carte", en: "Card" },
  CASH: { fr: "Especes", en: "Cash" },
};

function formatDateTime(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function GpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const [{ locale }, { from, to, q }] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);

  const [store, viewer] = await Promise.all([
    prisma.store.findUnique({
      where: { slug: "jontaado-gp" },
      select: { id: true, name: true, description: true },
    }),
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, phone: true, role: true },
        })
      : null,
  ]);

  if (!store) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
          <p className="text-sm text-zinc-300">
            {locale === "fr" ? "Boutique GP introuvable" : "GP store not found"}
          </p>
          <Link
            href="/stores"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Retour aux boutiques" : "Back to stores"}
          </Link>
        </div>
      </div>
    );
  }

  const normalizedFrom = from?.trim() ?? "";
  const normalizedTo = to?.trim() ?? "";
  const normalizedQuery = q?.trim() ?? "";

  const where: Record<string, unknown> = {
    storeId: store.id,
    isActive: true,
    status: "OPEN",
  };

  if (normalizedFrom) {
    where.originCity = { contains: normalizedFrom, mode: "insensitive" };
  }

  if (normalizedTo) {
    where.destinationCity = { contains: normalizedTo, mode: "insensitive" };
  }

  if (normalizedQuery) {
    where.OR = [
      { airline: { contains: normalizedQuery, mode: "insensitive" } },
      { flightNumber: { contains: normalizedQuery, mode: "insensitive" } },
      { originAddress: { contains: normalizedQuery, mode: "insensitive" } },
      { destinationAddress: { contains: normalizedQuery, mode: "insensitive" } },
    ];
  }

  const [trips, totalTrips, activeTransporters] = await Promise.all([
    prisma.gpTrip.findMany({
      where,
      orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
      include: {
        transporter: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      take: 60,
    }),
    prisma.gpTrip.count({
      where: { storeId: store.id, isActive: true, status: "OPEN" },
    }),
    prisma.gpTrip.findMany({
      where: { storeId: store.id, isActive: true, status: "OPEN" },
      distinct: ["transporterId"],
      select: { transporterId: true },
    }),
  ]);

  const canPublish =
    viewer?.role === "TRANSPORTER" || viewer?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
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
        <Link
          href="/stores"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {locale === "fr" ? "Retour aux boutiques" : "Back to stores"}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-300/15 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
            JONTAADO GP
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {locale === "fr"
              ? "Transport de colis par voyageurs"
              : "Parcel transport by travelers"}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">
            {locale === "fr"
              ? "Deposez vos annonces de transport: trajet, vol, kilos dispo, tarif par kilo et moyens de paiement acceptes."
              : "Publish transport offers with route, flight, available kilos, price per kilo and accepted payments."}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3 fade-up">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Annonces actives" : "Active listings"}
            </p>
            <p className="mt-2 text-xl font-semibold text-violet-200">{totalTrips}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Transporteurs actifs" : "Active transporters"}
            </p>
            <p className="mt-2 text-xl font-semibold text-violet-200">{activeTransporters.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              {locale === "fr" ? "Prix moyen/kg" : "Average price/kg"}
            </p>
            <p className="mt-2 text-xl font-semibold text-violet-200">
              {trips.length > 0
                ? `${Math.round(
                    trips.reduce((acc, trip) => acc + trip.pricePerKgCents, 0) / trips.length
                  )} FCFA`
                : "-"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 fade-up">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" method="GET">
            <input
              name="from"
              defaultValue={normalizedFrom}
              className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
              placeholder={locale === "fr" ? "Depart (ville)" : "From (city)"}
            />
            <input
              name="to"
              defaultValue={normalizedTo}
              className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
              placeholder={locale === "fr" ? "Arrivee (ville)" : "To (city)"}
            />
            <input
              name="q"
              defaultValue={normalizedQuery}
              className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
              placeholder={locale === "fr" ? "Compagnie, vol, adresse" : "Airline, flight, address"}
            />
            <button
              type="submit"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              {locale === "fr" ? "Filtrer" : "Filter"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 fade-up">
          <GpTripPublisher
            locale={locale}
            canPublish={Boolean(canPublish)}
            defaultContactPhone={viewer?.phone}
          />
          {!canPublish && (
            <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs text-amber-200">
              {locale === "fr"
                ? "Le depot d'annonce GP est reserve aux transporteurs verifies."
                : "GP listings are available for verified transporters only."}{" "}
              <Link href="/profile" className="underline underline-offset-2">
                {locale === "fr" ? "Completer mon profil" : "Complete my profile"}
              </Link>
            </div>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2 fade-up">
          {trips.map((trip) => (
            <article
              key={trip.id}
              className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {trip.originCity} {"->"} {trip.destinationCity}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {trip.airline} - {trip.flightNumber}
                  </p>
                </div>
                <span className="rounded-full bg-violet-300/15 px-3 py-1 text-xs text-violet-200">
                  {trip.availableKg} kg
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-zinc-300">
                <p>
                  <span className="text-zinc-400">
                    {locale === "fr" ? "Depart:" : "Departure:"}
                  </span>{" "}
                  {trip.originAddress}
                </p>
                <p>
                  <span className="text-zinc-400">
                    {locale === "fr" ? "Arrivee:" : "Arrival:"}
                  </span>{" "}
                  {trip.destinationAddress}
                </p>
                <p>
                  <span className="text-zinc-400">
                    {locale === "fr" ? "Date vol:" : "Flight date:"}
                  </span>{" "}
                  {formatDateTime(locale, trip.flightDate)}
                </p>
                <p>
                  <span className="text-zinc-400">
                    {locale === "fr" ? "Livraison:" : "Delivery:"}
                  </span>{" "}
                  {formatDateTime(locale, trip.deliveryStartAt)}
                  {trip.deliveryEndAt ? ` -> ${formatDateTime(locale, trip.deliveryEndAt)}` : ""}
                </p>
                <p>
                  <span className="text-zinc-400">
                    {locale === "fr" ? "Tarif:" : "Rate:"}
                  </span>{" "}
                  <span className="font-semibold text-emerald-200">
                    {trip.pricePerKgCents} FCFA/kg
                  </span>
                </p>
                <p>
                  <span className="text-zinc-400">
                    {locale === "fr" ? "Paiements acceptes:" : "Accepted payments:"}
                  </span>{" "}
                  {trip.acceptedPaymentMethods
                    .map((method) =>
                      locale === "fr"
                        ? paymentMethodLabels[method]?.fr ?? method
                        : paymentMethodLabels[method]?.en ?? method
                    )
                    .join(", ")}
                </p>
                {trip.maxPackages && (
                  <p>
                    <span className="text-zinc-400">
                      {locale === "fr" ? "Max colis:" : "Max parcels:"}
                    </span>{" "}
                    {trip.maxPackages}
                  </p>
                )}
                {(trip.contactPhone || trip.transporter.phone) && (
                  <p>
                    <span className="text-zinc-400">
                      {locale === "fr" ? "Contact:" : "Contact:"}
                    </span>{" "}
                    {trip.contactPhone ?? trip.transporter.phone}
                  </p>
                )}
                {trip.notes && (
                  <p>
                    <span className="text-zinc-400">
                      {locale === "fr" ? "Notes:" : "Notes:"}
                    </span>{" "}
                    {trip.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-white/10 pt-3 text-xs text-zinc-400">
                {locale === "fr" ? "Transporteur" : "Transporter"}: {trip.transporter.name ?? "-"}
              </div>
            </article>
          ))}

          {trips.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-sm text-zinc-300 md:col-span-2">
              {locale === "fr"
                ? "Aucune annonce GP active pour ce filtre."
                : "No active GP listings for this filter."}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

