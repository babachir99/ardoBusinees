import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import OrdersLookup from "@/components/orders/OrdersLookup";
import OrdersList from "@/components/orders/OrdersList";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buildStoreMetadata } from "@/lib/storeSeo";

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
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-[#0b0f12] text-white">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
            {t("kicker")}
          </p>
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
