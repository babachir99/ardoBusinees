import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import OrderDetail from "@/components/orders/OrderDetail";
import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import MarketplaceHero from "@/components/marketplace/MarketplaceHero";
import MarketplaceHeroDynamicTitle from "@/components/marketplace/MarketplaceHeroDynamicTitle";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buildStoreMetadata } from "@/lib/storeSeo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: `/orders/${id}`,
    title: isFr ? "Detail commande | Espace prive" : "Order detail | Private space",
    description: isFr
      ? "Retrouve le detail et le suivi d'une commande dans ton espace prive."
      : "Review order details and tracking in your private space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = await getTranslations("Orders");
  const session = await getServerSession(authOptions);
  const { id, locale } = await params;
  const isFr = locale === "fr";
  const heroLines = isFr
    ? [
        "avec suivi, livraison et vendeur reunis",
        "pour retrouver chaque etape sans friction",
      ]
    : [
        "with tracking, shipping and seller in one place",
        "to revisit every step without friction",
      ];

  if (!session) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <AppHeader locale={locale} />

        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
          <MarketplaceHero
            title={
              <MarketplaceHeroDynamicTitle
                fixedLine={t("detail.title")}
                lines={heroLines}
                lineClassName="text-zinc-400"
              />
            }
            subtitle={t("detail.subtitle")}
            compact
            accentClassName="from-emerald-500/18 via-zinc-950/92 to-zinc-950"
          />

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {isFr ? "Connexion requise" : "Sign in required"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {isFr
                ? "Connecte-toi pour acceder au detail de ta commande."
                : "Sign in to access your order detail."}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {isFr ? "Se connecter" : "Sign in"}
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <MarketplaceHero
          title={
            <MarketplaceHeroDynamicTitle
              fixedLine={t("detail.title")}
              lines={heroLines}
              lineClassName="text-zinc-400"
            />
          }
          subtitle={t("detail.subtitle")}
          compact
          accentClassName="from-emerald-500/18 via-zinc-950/92 to-zinc-950"
        />

        <OrderDetail orderId={id} />
      </main>

      <Footer />
    </div>
  );
}
