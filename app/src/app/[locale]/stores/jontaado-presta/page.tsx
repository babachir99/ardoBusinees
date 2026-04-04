import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import SponsoredPlacement from "@/components/ads/SponsoredPlacement";
import { authOptions } from "@/lib/auth";
import PrestaStoreClient from "@/components/presta/PrestaStoreClient";
import { getHomePromoEntries } from "@/lib/homePromos";
import { filterHomePromosForPlacement } from "@/lib/homePromos.shared";
import { Vertical, getVerticalRules } from "@/lib/verticals";
import { hasAnyUserRole } from "@/lib/userRoles";

export default async function PrestaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [session, homePromoConfig] = await Promise.all([
    getServerSession(authOptions),
    getHomePromoEntries(),
  ]);

  const rules = getVerticalRules(Vertical.PRESTA);
  const canPublish = hasAnyUserRole(session?.user, rules.publishRoles);
  const sponsoredInlinePromo =
    filterHomePromosForPlacement(homePromoConfig.entries, {
      placement: "STORE_INLINE",
      isLoggedIn: Boolean(session?.user?.id),
      storeSlug: "jontaado-presta",
    })[0] ?? null;

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          badge="JONTAADO PRESTA"
          title={locale === "fr" ? "Services locaux premium" : "Premium local services"}
          subtitle={
            locale === "fr"
              ? "Explore les offres, publie un besoin et ouvre ton espace prestataire dans une interface plus simple, plus rapide et plus premium."
              : "Explore offers, publish a need and open your provider space through a simpler, faster and more premium interface."
          }
          accentClassName="from-amber-500/18 via-zinc-950/92 to-zinc-950"
          primaryAction={
            <a
              href="#presta-market"
              className="inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-300"
            >
              {locale === "fr" ? "Explorer PRESTA" : "Explore PRESTA"}
            </a>
          }
          secondaryAction={
            canPublish ? (
              <Link
                href="/stores/jontaado-presta/dashboard"
                className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 transition duration-200 hover:scale-[1.02] hover:border-amber-300/35 hover:bg-white/10"
              >
                {locale === "fr" ? "Ouvrir le dashboard PRESTA" : "Open PRESTA dashboard"}
              </Link>
            ) : null
          }
          highlights={[
            locale === "fr" ? "Offres et besoins dans un meme espace lisible." : "Offers and needs in one readable space.",
            locale === "fr" ? "Publication de besoin plus guidee, moins intimidante." : "A more guided, less intimidating need composer.",
            locale === "fr" ? "Acces dashboard plus clair pour les prestataires." : "Clearer dashboard access for providers.",
          ]}
        />

        {sponsoredInlinePromo ? (
          <SponsoredPlacement
            locale={locale}
            promo={sponsoredInlinePromo}
            variant="inline"
          />
        ) : null}

        <PrestaStoreClient
          locale={locale}
          isLoggedIn={Boolean(session?.user?.id)}
          canPublish={canPublish}
          currentUserId={session?.user?.id ?? null}
          currentUserRole={session?.user?.role ?? null}
        />
      </main>

      <Footer />
    </div>
  );
}

