import { getServerSession } from "next-auth";
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
          title={locale === "fr" ? "Trouve ou propose un service" : "Find or offer a service"}
          compact
          accentClassName="from-amber-500/18 via-zinc-950/92 to-zinc-950"
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

