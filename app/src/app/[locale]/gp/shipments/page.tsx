import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/lib/auth";
import GpShipmentsTimelineClient from "@/components/gp/GpShipmentsTimelineClient";
import GpStoreShell from "@/components/gp/GpStoreShell";
import { buildStoreMetadata } from "@/lib/storeSeo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: "/stores/jontaado-gp/shipments",
    title: isFr ? "Expeditions GP | Suivi prive" : "GP shipments | Private tracking",
    description: isFr
      ? "Retrouve le suivi detaille de tes expeditions GP dans un espace prive reserve aux participants."
      : "Review detailed GP shipment tracking in a private space reserved for participants.",
    imagePath: "/stores/gp.png",
    noIndex: true,
  });
}

function canAccess(role: string | undefined) {
  return ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER", "CUSTOMER"].includes(role ?? "");
}

export default async function GpShipmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !canAccess(session.user.role)) {
    return (
      <GpStoreShell
        locale={locale}
        activeSection="shipments"
        title={locale === "fr" ? "Shipments GP" : "GP shipments"}
        description={
          locale === "fr"
            ? "Le suivi detaille est reserve aux participants GP."
            : "Detailed tracking is reserved for GP participants."
        }
        showBookings={Boolean(session?.user?.id)}
        showDashboard={["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER"].includes(session?.user?.role ?? "")}
        showShipments={Boolean(session?.user?.id)}
      >
        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <h2 className="text-2xl font-semibold text-white">
            {locale === "fr" ? "Acces GP requis" : "GP access required"}
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            {locale === "fr"
              ? "Cette page est reservee aux participants GP."
              : "This page is reserved for GP participants."}
          </p>
          <Link
            href="/stores/jontaado-gp"
            className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
          >
            {locale === "fr" ? "Retour a GP" : "Back to GP"}
          </Link>
        </div>
      </GpStoreShell>
    );
  }

  return (
    <GpStoreShell
      locale={locale}
      activeSection="shipments"
      title={locale === "fr" ? "Timeline shipments" : "Shipments timeline"}
      description={
        locale === "fr"
          ? "Suivi des shipments actifs avec timeline, preuves et confirmation de reception."
          : "Track active shipments with timeline, proofs and receipt confirmation."
      }
      showBookings={Boolean(session?.user?.id)}
      showDashboard={["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER"].includes(session?.user?.role ?? "")}
      showShipments={Boolean(session?.user?.id)}
    >
      <div className="flex flex-col gap-6">
        <GpShipmentsTimelineClient locale={locale} currentUserId={session.user.id} currentUserRole={session.user.role ?? null} />
      </div>
    </GpStoreShell>
  );
}
