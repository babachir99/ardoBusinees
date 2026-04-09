import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import {
  marketplaceActionPrimaryClass,
  marketplaceActionSecondaryClass,
} from "@/components/marketplace/MarketplaceActions";
import MarketplaceActions from "@/components/marketplace/MarketplaceActions";
import MarketplaceCard from "@/components/marketplace/MarketplaceCard";

export default async function ImmoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, t] = await Promise.all([
    params,
    getTranslations("Verticals.immo"),
  ]);
  const isFr = locale === "fr";
  const features = t.raw("features") as string[];

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={isFr ? "Trouve ou publie un bien" : "Find or list a property"}
          compact
          accentClassName="from-cyan-500/16 via-zinc-950/92 to-zinc-950"
        />

        <MarketplaceActions
          left={
            <>
              <Link
                href="/immo"
                className={marketplaceActionPrimaryClass}
              >
                {isFr ? "Explorer annonces" : "Explore listings"}
              </Link>
              <Link
                href="/immo/my"
                className={marketplaceActionSecondaryClass}
              >
                {isFr ? "Mes annonces" : "My listings"}
              </Link>
            </>
          }
        />

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <MarketplaceCard
              key={feature}
              label={isFr ? `Parcours ${index + 1}` : `Flow ${index + 1}`}
              title={feature}
              description={
                isFr
                  ? "Un bloc plus lisible et premium pour explorer, publier et suivre ses biens sans redondance."
                  : "A cleaner premium block to explore, publish and track properties without redundancy."
              }
            />
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
