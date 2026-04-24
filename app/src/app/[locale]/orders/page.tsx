import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import OrdersLookup from "@/components/orders/OrdersLookup";
import OrdersList from "@/components/orders/OrdersList";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buildStoreMetadata } from "@/lib/storeSeo";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceHeroDynamicTitle from "@/components/marketplace/MarketplaceHeroDynamicTitle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: "/orders",
    title: isFr ? "Commandes | Espace prive" : "Orders | Private space",
    description: isFr
      ? "Retrouve et suis tes commandes dans ton espace prive."
      : "Review and track your orders in your private space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function OrdersPage() {
  const t = await getTranslations("Orders");
  const locale = await getLocale();
  const isFr = locale === "fr";
  const session = await getServerSession(authOptions);
  const heroLines = isFr
    ? [
        "du paiement a la livraison",
        "avec chaque etape bien visible",
        "pour retrouver vite l'essentiel",
        "sans perdre le fil du suivi",
      ]
    : [
        "from payment to delivery",
        "with every step in view",
        "to find what matters faster",
        "without losing the thread",
      ];

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={
            <MarketplaceHeroDynamicTitle
              fixedLine={t("title")}
              lines={heroLines}
              lineClassName="text-zinc-400"
            />
          }
          subtitle={session ? t("subtitleDashboard") : t("subtitle")}
          compact
          accentClassName="from-emerald-500/18 via-zinc-950/92 to-zinc-950"
        />

        {session ? (
          <OrdersList />
        ) : (
          <div className="grid gap-4">
            <OrdersLookup />
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
              <p className="text-sm text-zinc-300">{t("signinHint")}</p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
              >
                {t("signinCta")}
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
