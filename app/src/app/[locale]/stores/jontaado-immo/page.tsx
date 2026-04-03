import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
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
          badge="JONTAADO IMMO"
          title={t("title")}
          subtitle={t("subtitle")}
          accentClassName="from-cyan-500/16 via-zinc-950/92 to-zinc-950"
          primaryAction={
            <Link
              href="/immo"
              className="inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-300"
            >
              {isFr ? "Explorer les annonces" : "Browse listings"}
            </Link>
          }
          secondaryAction={
            <Link
              href="/immo/my"
              className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 transition duration-200 hover:scale-[1.02] hover:border-cyan-300/35 hover:bg-white/10"
            >
              {isFr ? "Mes annonces" : "My listings"}
            </Link>
          }
          highlights={features.slice(0, 3)}
        />

        <MarketplaceActions
          left={
            <>
              <Link
                href="/immo"
                className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02]"
              >
                {isFr ? "Explorer annonces" : "Explore listings"}
              </Link>
              <Link
                href="/immo/my"
                className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/10"
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
