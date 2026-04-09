import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
import MarketplaceCard from "@/components/marketplace/MarketplaceCard";

export default async function CarsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, t] = await Promise.all([params, getTranslations("Verticals.cars")]);
  const isFr = locale === "fr";
  const features = t.raw("features") as string[];

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
                href="/cars"
                className={marketplaceActionPrimaryClass}
              >
                {isFr ? "Explorer" : "Explore"}
              </Link>
              <Link
                href="/cars/dealers"
                className={marketplaceActionSecondaryClass}
              >
                {isFr ? "Concessionnaires" : "Dealers"}
              </Link>
              <Link
                href="/cars/my"
                className={marketplaceActionSecondaryClass}
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

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <MarketplaceCard
              key={feature}
              label={isFr ? `Experience ${index + 1}` : `Experience ${index + 1}`}
              title={feature}
              description={
                isFr
                  ? "Une promesse claire pour explorer, comparer et publier plus vite sans surcharge visuelle."
                  : "A clear promise to explore, compare and publish faster without visual overload."
              }
            />
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
