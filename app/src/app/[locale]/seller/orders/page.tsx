import type { Metadata } from "next";
import SellerOrdersPanel from "@/components/seller/SellerOrdersPanel";
import Footer from "@/components/layout/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
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
    path: "/seller/orders",
    title: isFr ? "Commandes vendeur | Espace prive" : "Seller orders | Private space",
    description: isFr
      ? "Retrouve et gere les commandes de ta boutique depuis ton espace vendeur prive."
      : "Review and manage your shop orders from your private seller space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function SellerOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">Connexion requise</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Connecte-toi avec un compte vendeur pour acceder a tes commandes.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              Se connecter
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[115px] w-auto md:h-[135px]"
            priority
          />
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/seller"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            Espace vendeur
          </Link>
          <Link
            href="/seller/products"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/60"
          >
            Produits
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-12">
        <SellerOrdersPanel />
      </main>
      <Footer />
    </div>
  );
}
