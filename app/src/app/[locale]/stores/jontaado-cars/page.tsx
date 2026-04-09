import { Link } from "@/i18n/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceAdRequestButton from "@/components/ads/MarketplaceAdRequestButton";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceHeroDynamicTitle from "@/components/marketplace/MarketplaceHeroDynamicTitle";
import {
  marketplaceActionPrimaryClass,
  marketplaceActionSecondaryClass,
} from "@/components/marketplace/MarketplaceActions";
import MarketplaceActions from "@/components/marketplace/MarketplaceActions";
import Footer from "@/components/layout/Footer";
import { CarsDealersSection, CarsExplorerSection, CarsMySection } from "@/components/cars/CarsStoreSections";
import {
  buildCarsStoreHref,
  getCarsDealersData,
  getCarsExplorerData,
  getCarsMyDashboardData,
  normalizeCarsStoreTab,
  type CarsStoreSearchParams,
} from "@/lib/carsStorefront";

export default async function CarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CarsStoreSearchParams>;
}) {
  const [{ locale }, rawSearchParams, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);
  const isFr = locale === "fr";
  const activeTab = normalizeCarsStoreTab(rawSearchParams.tab);
  const carsStoreHref = buildCarsStoreHref(locale);

  const [explorerData, dealersData, myDashboardData] = await Promise.all([
    activeTab === "explore" ? getCarsExplorerData(rawSearchParams) : Promise.resolve(null),
    activeTab === "dealers" ? getCarsDealersData(rawSearchParams) : Promise.resolve(null),
    activeTab === "my" ? getCarsMyDashboardData(session?.user?.id ?? null) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={
            <MarketplaceHeroDynamicTitle
              fixedLine={isFr ? "Trouve ou publie un vehicule" : "Find or list a vehicle"}
              lines={
                isFr
                  ? ["au bon prix", "avec des vendeurs fiables", "sans perdre de temps", "pres de chez toi"]
                  : ["at the right price", "with trusted sellers", "without wasting time", "near you"]
              }
            />
          }
          compact
          accentClassName="from-rose-500/16 via-zinc-950/92 to-zinc-950"
        />

        <MarketplaceActions
          left={
            <>
              <Link
                href={buildCarsStoreHref(locale, {
                  tab: "explore",
                  params: rawSearchParams,
                })}
                className={activeTab === "explore" ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass}
              >
                {isFr ? "Explorer" : "Explore"}
              </Link>
              <Link
                href={buildCarsStoreHref(locale, {
                  tab: "dealers",
                  params: rawSearchParams,
                })}
                className={activeTab === "dealers" ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass}
              >
                {isFr ? "Concessionnaires" : "Dealers"}
              </Link>
              <Link
                href={buildCarsStoreHref(locale, {
                  tab: "my",
                })}
                className={activeTab === "my" ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass}
              >
                {isFr ? "Mes annonces" : "My listings"}
              </Link>
            </>
          }
          right={
            <MarketplaceAdRequestButton
              locale={locale}
              sourceVertical="CARS"
              label={isFr ? "Demander une pub" : "Request an ad"}
              className={marketplaceActionSecondaryClass}
            />
          }
        />

        {activeTab === "explore" && explorerData ? (
          <CarsExplorerSection locale={locale} basePath={carsStoreHref} data={explorerData} />
        ) : null}

        {activeTab === "dealers" && dealersData ? (
          <CarsDealersSection locale={locale} basePath={carsStoreHref} data={dealersData} />
        ) : null}

        {activeTab === "my" ? <CarsMySection locale={locale} data={myDashboardData} /> : null}
      </main>
      <Footer />
    </div>
  );
}
