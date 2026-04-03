import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import TiakStoreClient from "@/components/tiak/TiakStoreClient";
import { authOptions } from "@/lib/auth";
import { hasAnyUserRole } from "@/lib/userRoles";
import { Vertical, getVerticalRules } from "@/lib/verticals";

export default async function TiakTiakPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const canOpenDashboard = hasAnyUserRole(session?.user, getVerticalRules(Vertical.TIAK_TIAK).publishRoles);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          badge="JONTAADO TIAK TIAK"
          title={locale === "fr" ? "Livraison locale express" : "Fast local delivery"}
          subtitle={
            locale === "fr"
              ? "Lance une mission, trouve un coursier, suis les preuves et pilote l'historique dans un flux premium et plus actionnable."
              : "Launch a mission, find a courier, track proofs and manage history through a premium, more actionable flow."
          }
          accentClassName="from-emerald-500/18 via-zinc-950/92 to-zinc-950"
          primaryAction={
            <Link
              href="#tiak-dispatch"
              className="inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-300"
            >
              {locale === "fr" ? "Voir le dispatch" : "View dispatch"}
            </Link>
          }
          secondaryAction={
            canOpenDashboard ? (
              <Link
                href="/stores/jontaado-tiak-tiak/dashboard"
                className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 transition duration-200 hover:scale-[1.02] hover:border-emerald-300/35 hover:bg-white/10"
              >
                {locale === "fr" ? "Ouvrir le dashboard TIAK" : "Open TIAK dashboard"}
              </Link>
            ) : null
          }
          highlights={[
            locale === "fr" ? "Dispatch compact avec actions plus claires." : "Compact dispatch with clearer actions.",
            locale === "fr" ? "Historique et notifications plus faciles a piloter." : "History and notifications are easier to manage.",
            locale === "fr" ? "Acces dashboard plus direct pour les coursiers." : "More direct dashboard access for couriers.",
          ]}
        />

        <TiakStoreClient
          locale={locale}
          isLoggedIn={Boolean(session?.user?.id)}
          currentUserId={session?.user?.id ?? null}
          currentUserRole={session?.user?.role ?? null}
        />
      </main>

      <Footer />
    </div>
  );
}

