import type { Metadata } from "next";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import GpStoreShell from "@/components/gp/GpStoreShell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreMetadata } from "@/lib/storeSeo";
import { hasAnyUserRole } from "@/lib/userRoles";
import { Vertical, getVerticalRules } from "@/lib/verticals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(locale: string, value: Date | null) {
  if (!value) return locale === "fr" ? "Aucune date" : "No date yet";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(value);
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
    path: "/stores/jontaado-gp/transporters",
    title: isFr ? "Transporteurs GP | JONTAADO" : "GP carriers | JONTAADO",
    description: isFr
      ? "Explore les profils des transporteurs GP, leurs notes et leurs trajets actuellement ouverts."
      : "Browse GP carrier profiles, ratings and currently open trips.",
    imagePath: "/stores/gp.png",
  });
}

export default async function GpTransportersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const canOpenDashboard = hasAnyUserRole(session?.user, getVerticalRules(Vertical.GP).publishRoles);

  const transporters = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "TRANSPORTER" },
        {
          roleAssignments: {
            some: {
              role: { in: ["GP_CARRIER", "TRANSPORTER", "ADMIN"] },
              status: "ACTIVE",
            },
          },
        },
      ],
      gpTrips: {
        some: {
          isActive: true,
          status: "OPEN",
        },
      },
    },
    orderBy: [
      { transporterRating: "desc" },
      { transporterReviewCount: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      name: true,
      image: true,
      phone: true,
      transporterRating: true,
      transporterReviewCount: true,
      gpTrips: {
        where: {
          isActive: true,
          status: "OPEN",
        },
        orderBy: [{ flightDate: "asc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          originCity: true,
          destinationCity: true,
          flightDate: true,
          availableKg: true,
          pricePerKgCents: true,
          currency: true,
        },
      },
      _count: {
        select: {
          gpTrips: true,
        },
      },
    },
  });

  return (
    <GpStoreShell
      locale={locale}
      activeSection="transporters"
      title={locale === "fr" ? "Transporteurs GP" : "GP carriers"}
      description={
        locale === "fr"
          ? "Repere rapidement les profils les plus solides, compare les notes et ouvre leurs trajets en un clic."
          : "Quickly spot the strongest profiles, compare ratings and open their active trips in one click."
      }
      showBookings={Boolean(session?.user?.id)}
      showDashboard={canOpenDashboard}
      showShipments={Boolean(session?.user?.id)}
      topAction={
        <Link
          href="/stores/jontaado-gp"
          className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/80"
        >
          {locale === "fr" ? "Voir les trajets" : "View trips"}
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {locale === "fr" ? "Profils actifs" : "Active profiles"}
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{transporters.length}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr" ? "Avec au moins un trajet ouvert" : "With at least one open trip"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {locale === "fr" ? "Meilleure note" : "Top rating"}
          </p>
          <p className="mt-3 text-3xl font-semibold text-amber-100">
            {transporters.length > 0 ? Math.max(...transporters.map((entry) => entry.transporterRating)).toFixed(1) : "0.0"}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr" ? "Moyenne visible publique" : "Public rating average"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {locale === "fr" ? "Trajets visibles" : "Visible trips"}
          </p>
          <p className="mt-3 text-3xl font-semibold text-cyan-100">
            {transporters.reduce((sum, entry) => sum + entry.gpTrips.length, 0)}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {locale === "fr" ? "Echantillon charge sur cette page" : "Sample loaded on this page"}
          </p>
        </div>
      </section>

      {transporters.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-white/10 bg-zinc-900/50 p-8 text-sm text-zinc-400">
          {locale === "fr"
            ? "Aucun transporteur GP avec trajet ouvert pour le moment."
            : "No GP carrier with an open trip right now."}
        </section>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {transporters.map((transporter) => {
            const nextTrip = transporter.gpTrips[0] ?? null;

            return (
              <article
                key={transporter.id}
                className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/78 to-slate-950/82 p-6 shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_18px_42px_rgba(8,145,178,0.2)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-zinc-950/70">
                      {transporter.image ? (
                        <Image
                          src={transporter.image}
                          alt={transporter.name ?? "Transporter"}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                          {(transporter.name ?? "T").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">JONTAADO GP</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {transporter.name ?? (locale === "fr" ? "Transporteur" : "Transporter")}
                      </h2>
                      <p className="mt-1 text-sm text-amber-200">
                        * {transporter.transporterRating.toFixed(1)} ({transporter.transporterReviewCount}{" "}
                        {locale === "fr" ? "avis" : "reviews"})
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-right text-xs text-zinc-300">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      {locale === "fr" ? "Trajets ouverts" : "Open trips"}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">{transporter.gpTrips.length}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {transporter._count.gpTrips} {locale === "fr" ? "publies au total" : "published in total"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        {locale === "fr" ? "Prochains trajets" : "Upcoming trips"}
                      </p>
                      {nextTrip ? (
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100">
                          {formatDate(locale, nextTrip.flightDate)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-3">
                      {transporter.gpTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">
                              {trip.originCity} {"->"} {trip.destinationCity}
                            </p>
                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300">
                              {trip.availableKg} kg
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">
                            {formatDate(locale, trip.flightDate)} · {trip.pricePerKgCents}{" "}
                            {trip.currency === "XOF" ? "FCFA" : trip.currency}/kg
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        {locale === "fr" ? "Apercu" : "Overview"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {locale === "fr"
                          ? "Ouvre le profil pour voir les avis detailles et reserver sur ses trajets actifs."
                          : "Open the profile to see detailed reviews and book on active trips."}
                      </p>
                    </div>

                    {transporter.phone ? (
                      <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          {locale === "fr" ? "Contact partage" : "Shared contact"}
                        </p>
                        <p className="mt-2 text-white">{transporter.phone}</p>
                      </div>
                    ) : null}

                    <Link
                      href={`/stores/jontaado-gp/transporters/${transporter.id}`}
                      className="mt-auto inline-flex justify-center rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
                    >
                      {locale === "fr" ? "Voir le profil" : "View profile"}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </GpStoreShell>
  );
}
