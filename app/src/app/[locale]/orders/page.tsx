import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import OrdersLookup from "@/components/orders/OrdersLookup";
import OrdersList from "@/components/orders/OrdersList";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buildStoreMetadata } from "@/lib/storeSeo";
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
        "bien rangees et faciles a retrouver",
        "sans perdre le fil du suivi",
      ]
    : [
        "from payment to delivery",
        "with every step in view",
        "organized and easy to revisit",
        "without losing the thread",
      ];

  return (
    <div className="min-h-screen bg-[#0b0f12] text-white">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        <div className="mb-6 rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,17,22,0.95),rgba(18,43,36,0.72))] px-5 py-4 shadow-[0_24px_60px_-36px_rgba(16,185,129,0.45)] md:px-6 md:py-5">
          <div className="text-2xl font-semibold tracking-tight leading-none text-white md:text-3xl">
            <MarketplaceHeroDynamicTitle
              fixedLine={`${t("title")} —`}
              lines={heroLines}
              lineClassName="text-zinc-400"
              layout="inline"
            />
          </div>
        </div>
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
      </section>
      <Footer />
    </div>
  );
}
