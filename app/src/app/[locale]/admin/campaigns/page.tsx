import { Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getServerSession } from "next-auth";
import Footer from "@/components/layout/Footer";
import AdminHomePromosPanel from "@/components/admin/AdminHomePromosPanel";
import { authOptions } from "@/lib/auth";
import { hasUserRole } from "@/lib/userRoles";
import {
  getHomePromoAccentOptions,
  getHomePromoAudienceOptions,
  getHomePromoEntries,
  getHomePromoPlacementOptions,
  getHomePromoTrackingSummary,
} from "@/lib/homePromos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCampaignsPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();
  const isFr = locale.toLowerCase().startsWith("fr");

  if (!session || !hasUserRole(session.user, "ADMIN")) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {isFr ? "Acces reserve a l'administration" : "Admin access only"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {isFr
                ? "Connecte-toi avec un compte admin pour gerer les campagnes sponsorisees."
                : "Sign in with an admin account to manage sponsored campaigns."}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {isFr ? "Se connecter" : "Sign in"}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const [homePromoConfig, homePromoTrackingSummary] = await Promise.all([
    getHomePromoEntries(),
    getHomePromoTrackingSummary().catch(() => ({
      totals: { IMPRESSION: 0, CLICK: 0, DISMISS: 0 },
      anonymousTotals: { IMPRESSION: 0, CLICK: 0, DISMISS: 0 },
      ctr: 0,
      byPromoId: {},
    })),
  ]);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-24 pt-10">
        <section className="rounded-3xl border border-white/10 bg-zinc-900/55 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.25)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
                {isFr ? "Gestion admin" : "Admin management"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                {isFr ? "Campagnes sponsorisees JONTAADO" : "JONTAADO sponsored campaigns"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-300 md:text-base">
                {isFr
                  ? "Ici, on garde l'espace propre: pilotage des formats popup, inline, cartes produit et bandeaux verticaux dans une page dediee."
                  : "Keep the main admin clean: manage popup, inline, product-card, and vertical banner campaigns from one dedicated page."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin"
                className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-white/30 hover:bg-white/10"
              >
                {isFr ? "Retour admin" : "Back to admin"}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                title: isFr ? "Popup accueil" : "Homepage popup",
                body: isFr
                  ? "Pour une campagne forte, ponctuelle et tres visible."
                  : "For high-impact, time-bound visibility.",
              },
              {
                title: isFr ? "Inline apres 2 lignes" : "Inline after 2 rows",
                body: isFr
                  ? "Le meilleur compromis entre visibilite, contexte et confort de lecture."
                  : "Best balance between visibility, context, and reading comfort.",
              },
              {
                title: isFr ? "Carte dans les produits" : "Card in product feed",
                body: isFr
                  ? "Le format le plus natif pour se fondre dans le feed marketplace."
                  : "The most native format to blend into the marketplace feed.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 bg-zinc-950/55 p-4"
              >
                <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <AdminHomePromosPanel
          locale={locale}
          initialPromos={homePromoConfig.entries}
          accentOptions={getHomePromoAccentOptions()}
          placementOptions={getHomePromoPlacementOptions()}
          audienceOptions={getHomePromoAudienceOptions()}
          trackingSummary={homePromoTrackingSummary}
          lastUpdatedAt={homePromoConfig.lastUpdatedAt ? homePromoConfig.lastUpdatedAt.toISOString() : null}
          lastUpdatedBy={homePromoConfig.lastUpdatedBy}
        />
      </main>
      <Footer />
    </div>
  );
}
