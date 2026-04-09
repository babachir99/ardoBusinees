import { getServerSession } from "next-auth";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
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
          title={locale === "fr" ? "Lance ou suis une livraison" : "Start or track a delivery"}
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

