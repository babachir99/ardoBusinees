import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import NewProductForm from "@/components/seller/NewProductForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    path: "/seller/products/new",
    title: isFr ? "Nouveau produit vendeur | Espace prive" : "New seller product | Private space",
    description: isFr
      ? "Cree une nouvelle fiche produit depuis ton espace vendeur prive."
      : "Create a new product listing from your private seller space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function NewProductPage() {
  const session = await getServerSession(authOptions);
  const t = await getTranslations("SellerProduct");

  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">{t("guard.title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("guard.subtitle")}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {t("guard.cta")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-24 pt-10">
        <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 card-glow fade-up">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
        </section>

        <NewProductForm />
      </main>

      <Footer />
    </div>
  );
}
