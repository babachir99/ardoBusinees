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
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: `/stores/jontaado-gp/bookings/${id}`,
    title: isFr ? "Detail reservation GP | JONTAADO" : "GP booking detail | JONTAADO",
    description: isFr
      ? "Consulte le detail complet d'une reservation GP, son transporteur, son shipment et les etapes de suivi."
      : "Review the full detail of a GP booking, its carrier, shipment and tracking milestones.",
    imagePath: "/stores/gp.png",
    noIndex: true,
  });
}

export default async function GpBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession(authOptions);
  const canOpenDashboard = hasAnyUserRole(session?.user, getVerticalRules(Vertical.GP).publishRoles);

  if (!session?.user?.id) {
    return (
      <GpStoreShell
        locale={locale}
        activeSection="bookings"
        title={locale === "fr" ? "Detail reservation GP" : "GP booking detail"}
        description={
          locale === "fr"
            ? "Connecte-toi pour ouvrir le detail d'une reservation."
            : "Sign in to open a booking detail."
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
              ? "Le detail de reservation est lie a ton compte."
              : "Booking detail is tied to your account."}
          </p>
        </div>
      </GpStoreShell>
    );
  }

  const booking = await prisma.gpTripBooking.findFirst({
    where: {
      id,
      customerId: session.user.id,
    },
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
          originAddress: true,
          destinationAddress: true,
          flightDate: true,
          pricePerKgCents: true,
          currency: true,
          availableKg: true,
          transporter: {
            select: {
              id: true,
              name: true,
              phone: true,
              transporterRating: true,
              transporterReviewCount: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    return (
      <GpStoreShell
        locale={locale}
        activeSection="bookings"
        title={locale === "fr" ? "Reservation introuvable" : "Booking not found"}
        description={
          locale === "fr"
            ? "Cette reservation n'existe pas ou n'est pas accessible."
            : "This booking does not exist or is not accessible."
        }
        showBookings
        showDashboard={canOpenDashboard}
        showShipments={Boolean(session?.user?.id)}
      >
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <Link
            href="/stores/jontaado-gp/bookings"
            className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Retour aux reservations" : "Back to bookings"}
          </Link>
        </div>
      </GpStoreShell>
    );
  }

  const amount = booking.requestedKg * booking.trip.pricePerKgCents;
  const toneClass = bookingToneMap[booking.status] ?? "border-white/10 bg-white/5 text-zinc-100";
  const milestoneDates = [
    {
      key: "created",
      label: locale === "fr" ? "Demande envoyee" : "Request sent",
      value: booking.createdAt,
      done: true,
    },
    {
      key: "confirmed",
      label: locale === "fr" ? "Confirmation transporteur" : "Carrier confirmation",
      value: booking.confirmedAt,
      done: Boolean(booking.confirmedAt),
    },
    {
      key: "completed",
      label: locale === "fr" ? "Livraison confirmee" : "Delivery confirmed",
      value: booking.completedAt,
      done: Boolean(booking.completedAt || booking.status === "DELIVERED"),
    },
  ];

  return (
    <GpStoreShell
      locale={locale}
      activeSection="bookings"
      title={locale === "fr" ? "Detail reservation GP" : "GP booking detail"}
      description={
        locale === "fr"
          ? "Toutes les infos utiles sur cette demande, sans quitter l'univers GP."
          : "All the useful details for this request, without leaving the GP experience."
      }
      showBookings
      showDashboard={canOpenDashboard}
      showShipments={Boolean(session?.user?.id)}
      topAction={
        <Link
          href="/stores/jontaado-gp/bookings"
          className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/80"
        >
          {locale === "fr" ? "Retour aux reservations" : "Back to bookings"}
        </Link>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
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
              <h2 className="mt-4 text-2xl font-semibold text-white">
                {booking.trip.originCity} {"->"} {booking.trip.destinationCity}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {locale === "fr" ? "Reference" : "Reference"}: {booking.id}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-emerald-100">
                {formatMoney(amount, booking.trip.currency, locale)}
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                {booking.requestedKg} kg · {booking.packageCount} {locale === "fr" ? "colis" : "parcels"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {locale === "fr" ? "Trajet" : "Trip"}
              </p>
              <div className="mt-3 space-y-2 text-sm text-zinc-300">
                <p>{booking.trip.originAddress}</p>
                <p>{booking.trip.destinationAddress}</p>
                <p>{formatDate(locale, booking.trip.flightDate)}</p>
                <p>
                  {locale === "fr" ? "Capacite restante" : "Remaining capacity"}: {booking.trip.availableKg} kg
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {locale === "fr" ? "Transporteur" : "Transporter"}
              </p>
              <div className="mt-3 space-y-2 text-sm text-zinc-300">
                <p className="font-semibold text-white">
                  {booking.trip.transporter.name ?? (locale === "fr" ? "Transporteur" : "Transporter")}
                </p>
                <p className="text-amber-200">
                  * {booking.trip.transporter.transporterRating.toFixed(1)} (
                  {booking.trip.transporter.transporterReviewCount} {locale === "fr" ? "avis" : "reviews"})
                </p>
                {booking.trip.transporter.phone ? <p>{booking.trip.transporter.phone}</p> : null}
                <Link
                  href={`/stores/jontaado-gp/transporters/${booking.trip.transporter.id}`}
                  className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
                >
                  {locale === "fr" ? "Voir le profil" : "View profile"}
                </Link>
              </div>
            </div>
          </div>

          {booking.message ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {locale === "fr" ? "Message envoye" : "Sent message"}
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{booking.message}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {locale === "fr" ? "Suivi reservation" : "Booking timeline"}
            </p>
            <div className="mt-4 space-y-4">
              {milestoneDates.map((step) => (
                <div key={step.key} className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-950/70 text-xs">
                    {step.done ? "OK" : "X"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="mt-1 text-xs text-zinc-400">{formatDate(locale, step.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {locale === "fr" ? "Shipment" : "Shipment"}
            </p>
            {booking.shipment ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-zinc-300">
                  {locale === "fr" ? "Code" : "Code"}: <span className="font-semibold text-white">{booking.shipment.code}</span>
                </p>
                <p className="text-sm text-zinc-300">
                  {locale === "fr" ? "Derniere mise a jour" : "Latest update"}: {formatDate(locale, booking.shipment.updatedAt)}
                </p>
                <Link
                  href="/stores/jontaado-gp/shipments"
                  className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
                >
                  {locale === "fr" ? "Ouvrir le suivi" : "Open tracking"}
                </Link>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">
                {locale === "fr"
                  ? "Le shipment sera genere quand le transporteur acceptera la demande."
                  : "The shipment will be generated when the carrier accepts the request."}
              </p>
            )}
          </div>
        </div>
      </section>
    </GpStoreShell>
  );
}
