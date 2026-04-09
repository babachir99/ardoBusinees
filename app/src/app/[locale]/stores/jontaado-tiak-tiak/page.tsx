import { getServerSession } from "next-auth";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceHeroDynamicTitle from "@/components/marketplace/MarketplaceHeroDynamicTitle";
import TiakStoreClient from "@/components/tiak/TiakStoreClient";
import { authOptions } from "@/lib/auth";

export default async function TiakTiakPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={
            <MarketplaceHeroDynamicTitle
              fixedLine={locale === "fr" ? "Lance ou suis une livraison" : "Start or track a delivery"}
              lines={
                locale === "fr"
                  ? ["dans toute la ville", "avec un suivi clair", "sans perdre de temps", "avec des preuves a chaque etape"]
                  : ["across the city", "with clear tracking", "without wasting time", "with proof at every step"]
              }
            />
          }
          compact
          accentClassName="from-emerald-500/18 via-zinc-950/92 to-zinc-950"
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

