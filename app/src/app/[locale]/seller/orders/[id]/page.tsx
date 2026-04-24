import type { Metadata } from "next";
import SellerOrderDetail from "@/components/seller/SellerOrderDetail";
import Footer from "@/components/layout/Footer";
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
    path: `/seller/orders/${id}`,
    title: isFr ? "Detail commande vendeur | Espace prive" : "Seller order detail | Private space",
    description: isFr
      ? "Consulte le detail et le suivi d'une commande depuis ton espace vendeur prive."
      : "Review order details and follow-up from your private seller space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">Connexion requise</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Connecte-toi avec un compte vendeur pour acceder a cette commande.
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
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-12">
        <SellerOrderDetail orderId={id} />
      </main>
      <Footer />
    </div>
  );
}
