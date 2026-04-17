import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import GpStoreShell from "@/components/gp/GpStoreShell";
import { authOptions } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { buildStoreMetadata } from "@/lib/storeSeo";
import { hasAnyUserRole } from "@/lib/userRoles";
import { Vertical, getVerticalRules } from "@/lib/verticals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bookingToneMap: Record<string, string> = {
  PENDING: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  ACCEPTED: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  CONFIRMED: "border-indigo-300/30 bg-indigo-300/10 text-indigo-100",
  COMPLETED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  DELIVERED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  REJECTED: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  CANCELED: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

function formatDate(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Non precise" : "Not set";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function bookingLabel(locale: string, status: string) {
  const labels: Record<string, { fr: string; en: string }> = {
    PENDING: { fr: "En attente", en: "Pending" },
    ACCEPTED: { fr: "Acceptee", en: "Accepted" },
    CONFIRMED: { fr: "Confirmee", en: "Confirmed" },
    COMPLETED: { fr: "Terminee", en: "Completed" },
    DELIVERED: { fr: "Livree", en: "Delivered" },
    REJECTED: { fr: "Refusee", en: "Rejected" },
    CANCELED: { fr: "Annulee", en: "Canceled" },
  };

  const entry = labels[status] ?? { fr: status, en: status };
  return locale === "fr" ? entry.fr : entry.en;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: "/stores/jontaado-gp/bookings",
    title: isFr ? "Mes reservations GP | JONTAADO" : "My GP bookings | JONTAADO",
    description: isFr
      ? "Retrouve tes demandes GP, leur statut, le transporteur associe et l'acces direct au suivi."
      : "Review your GP booking requests, statuses, assigned transporter and direct shipment tracking.",
    imagePath: "/stores/gp.png",
    noIndex: true,
  });
}

export default async function GpBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const canOpenDashboard = hasAnyUserRole(session?.user, getVerticalRules(Vertical.GP).publishRoles);

  if (!session?.user?.id) {
    return (
      <GpStoreShell
        locale={locale}
        activeSection="bookings"
        title={locale === "fr" ? "Mes reservations GP" : "My GP bookings"}
        description={
          locale === "fr"
            ? "Connecte-toi pour retrouver tes demandes et leurs mises a jour."
            : "Sign in to review your requests and live updates."
        }
        showBookings={false}
        showDashboard={canOpenDashboard}
        showShipments={false}
      >
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <h2 className="text-2xl font-semibold text-white">
            {locale === "fr" ? "Connexion requise" : "Sign in required"}
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            {locale === "fr"
              ? "Tes reservations GP sont liees a ton compte."
              : "Your GP bookings are tied to your account."}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Se connecter" : "Sign in"}
          </Link>
        </div>
      </GpStoreShell>
    );
  }

  const bookings = await prisma.gpTripBooking.findMany({
    where: { customerId: session.user.id },
    orderBy: [{ createdAt: "desc" }],
    include: {
      shipment: {
        select: {
          id: true,
          code: true,
          status: true,
          updatedAt: true,
        },
      },
      trip: {
        select: {
          id: true,
          originCity: true,
          destinationCity: true,
          flightDate: true,
          pricePerKgCents: true,
          currency: true,
          transporter: {
            select: {
              id: true,
              name: true,
              transporterRating: true,
              transporterReviewCount: true,
            },
          },
        },
      },
    },
  });

  const pendingCount = bookings.filter((entry) => entry.status === "PENDING").length;
  const activeCount = bookings.filter((entry) =>
    ["ACCEPTED", "CONFIRMED", "COMPLETED", "DELIVERED"].includes(entry.status)
  ).length;

  return (
    <GpStoreShell
      locale={locale}
      activeSection="bookings"
      title={locale === "fr" ? "Mes reservations GP" : "My GP bookings"}
      description={
        locale === "fr"
          ? "Un seul espace pour suivre tes demandes, leurs confirmations et les shipments associes."
          : "One place to track your requests, confirmations and linked shipments."
      }
      showBookings
      showDashboard={canOpenDashboard}
      showShipments
      topAction={
        <Link
          href="/stores/jontaado-gp"
          className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/80"
        >
          {locale === "fr" ? "Explorer GP" : "Explore GP"}
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {locale === "fr" ? "Demandes" : "Requests"}
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{bookings.length}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr" ? "Toutes tes reservations GP" : "All your GP bookings"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {locale === "fr" ? "En attente" : "Pending"}
          </p>
          <p className="mt-3 text-3xl font-semibold text-amber-100">{pendingCount}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr" ? "A confirmer par le transporteur" : "Waiting for transporter confirmation"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {locale === "fr" ? "Actives" : "Active"}
          </p>
          <p className="mt-3 text-3xl font-semibold text-cyan-100">{activeCount}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr" ? "Avec shipment ou confirmation" : "With shipment or confirmation"}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {locale === "fr" ? "Historique des reservations" : "Booking history"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {locale === "fr"
                ? "Clique sur un transporteur ou ouvre le shipment quand il est disponible."
                : "Open a transporter profile or jump into shipment tracking when available."}
            </p>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 p-6 text-sm text-zinc-400">
            {locale === "fr"
              ? "Aucune reservation GP pour le moment. Explore les trajets pour envoyer ta premiere demande."
              : "No GP bookings yet. Explore trips to send your first request."}
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {bookings.map((booking) => {
              const toneClass = bookingToneMap[booking.status] ?? "border-white/10 bg-white/5 text-zinc-100";
              const amount = booking.requestedKg * booking.trip.pricePerKgCents;
              const transporterName =
                booking.trip.transporter.name ?? (locale === "fr" ? "Transporteur" : "Transporter");

              return (
                <article
                  key={booking.id}
                  className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>
                          {bookingLabel(locale, booking.status)}
                        </span>
                        {booking.shipment ? (
                          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                            {booking.shipment.code}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {booking.trip.originCity} {"->"} {booking.trip.destinationCity}
                      </h3>
                      <p className="text-sm text-zinc-400">
                        {locale === "fr" ? "Demande envoyee" : "Request sent"}: {formatDate(locale, booking.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-semibold text-emerald-100">
                        {formatMoney(amount, booking.trip.currency, locale)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {booking.requestedKg} kg · {booking.packageCount}{" "}
                        {locale === "fr" ? "colis" : "parcels"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        {locale === "fr" ? "Transporteur" : "Transporter"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{transporterName}</p>
                          <p className="mt-1 text-xs text-amber-200">
                            * {booking.trip.transporter.transporterRating.toFixed(1)} (
                            {booking.trip.transporter.transporterReviewCount} {locale === "fr" ? "avis" : "reviews"})
                          </p>
                        </div>
                        <Link
                          href={`/stores/jontaado-gp/transporters/${booking.trip.transporter.id}`}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
                        >
                          {locale === "fr" ? "Voir le profil" : "View profile"}
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        {locale === "fr" ? "Suivi" : "Tracking"}
                      </p>
                      {booking.shipment ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-zinc-300">
                            {locale === "fr" ? "Mise a jour" : "Updated"}:{" "}
                            {formatDate(locale, booking.shipment.updatedAt)}
                          </p>
                          <Link
                            href="/stores/jontaado-gp/shipments"
                            className="inline-flex rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:brightness-110"
                          >
                            {locale === "fr" ? "Ouvrir le shipment" : "Open shipment"}
                          </Link>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-zinc-400">
                          {locale === "fr"
                            ? "Le shipment apparaitra ici des que la demande sera acceptee."
                            : "The shipment will appear here as soon as the request is accepted."}
                        </p>
                      )}
                    </div>
                  </div>

                  {booking.message ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        {locale === "fr" ? "Message envoye" : "Sent message"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{booking.message}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </GpStoreShell>
  );
}
