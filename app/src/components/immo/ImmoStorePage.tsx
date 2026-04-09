import { Link } from "@/i18n/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceAdRequestButton from "@/components/ads/MarketplaceAdRequestButton";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceHeroDynamicTitle from "@/components/marketplace/MarketplaceHeroDynamicTitle";
import {
  marketplaceActionPrimaryClass,
  marketplaceActionSecondaryClass,
} from "@/components/marketplace/MarketplaceActions";
import MarketplaceActions from "@/components/marketplace/MarketplaceActions";
import {
  buildImmoStoreHref,
  getImmoAgenciesData,
  getImmoExplorerData,
  getImmoMyDashboardData,
  type ImmoStoreSearchParams,
  type ImmoStoreTab,
} from "@/lib/immoStorefront";
import {
  ImmoAgenciesSection,
  ImmoExplorerSection,
  ImmoMySection,
} from "@/components/immo/ImmoStoreSections";

export default async function ImmoStorePage({
  locale,
  activeTab,
  searchParams,
}: {
  locale: string;
  activeTab: ImmoStoreTab;
  searchParams: ImmoStoreSearchParams;
}) {
  const session = await getServerSession(authOptions);
  const isFr = locale === "fr";
  const formPath = buildImmoStoreHref(locale, {
    tab: activeTab,
    includeLocale: true,
  });
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/${locale}/stores/jontaado-immo/my`)}`;

  const [exploreData, agenciesData, myData] = await Promise.all([
    activeTab === "explore" ? getImmoExplorerData(searchParams) : Promise.resolve(null),
    activeTab === "agencies" ? getImmoAgenciesData(searchParams) : Promise.resolve(null),
    activeTab === "my" && session?.user?.id
      ? getImmoMyDashboardData(session.user.id)
      : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={
            <MarketplaceHeroDynamicTitle
              fixedLine={isFr ? "Trouve ou publie un bien" : "Find or list a property"}
              lines={
                isFr
                  ? [
                      "dans les bons quartiers",
                      "avec des annonces plus claires",
                      "sans visites inutiles",
                      "en toute serenite",
                    ]
                  : [
                      "in the right neighborhoods",
                      "with clearer listings",
                      "without wasted visits",
                      "with confidence",
                    ]
              }
            />
          }
          compact
          accentClassName="from-cyan-500/16 via-zinc-950/92 to-zinc-950"
        />

        <MarketplaceActions
          left={
            <>
              <Link
                href={buildImmoStoreHref(locale, { tab: "explore", params: searchParams })}
                className={activeTab === "explore" ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass}
              >
                {isFr ? "Explorer" : "Explore"}
              </Link>
              <Link
                href={buildImmoStoreHref(locale, { tab: "agencies", params: searchParams })}
                className={activeTab === "agencies" ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass}
              >
                {isFr ? "Agences" : "Agencies"}
              </Link>
              <Link
                href={buildImmoStoreHref(locale, { tab: "my" })}
                className={activeTab === "my" ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass}
              >
                {isFr ? "Mes annonces" : "My listings"}
              </Link>
            </>
          }
          right={
            <MarketplaceAdRequestButton
              locale={locale}
              sourceVertical="IMMO"
              label={isFr ? "Demander une pub" : "Request an ad"}
              className={marketplaceActionSecondaryClass}
            />
          }
        />

        {activeTab === "explore" && exploreData ? (
          <ImmoExplorerSection locale={locale} basePath={formPath} data={exploreData} />
        ) : null}

        {activeTab === "agencies" && agenciesData ? (
          <ImmoAgenciesSection locale={locale} basePath={formPath} data={agenciesData} />
        ) : null}

        {activeTab === "my" ? (
          <ImmoMySection locale={locale} loginHref={loginHref} data={myData} />
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
