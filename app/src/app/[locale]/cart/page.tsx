import type { Metadata } from "next";
import CartView from "@/components/cart/CartView";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
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
    path: "/cart",
    title: isFr ? "Panier | Espace prive" : "Cart | Private space",
    description: isFr
      ? "Retrouve les produits ajoutes a ton panier dans ton espace prive."
      : "Review the products added to your cart in your private space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} containerClassName="max-w-6xl" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24 pt-[92px] sm:pt-[100px]">
        <CartView />
      </main>
      <Footer />
    </div>
  );
}
