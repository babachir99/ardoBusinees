import type { Metadata } from "next";
import CheckoutForm from "@/components/cart/CheckoutForm";
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
    path: "/checkout",
    title: isFr ? "Paiement | Espace prive" : "Checkout | Private space",
    description: isFr
      ? "Finalise ta commande dans un espace prive securise."
      : "Complete your order in a secure private checkout space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} containerClassName="max-w-6xl" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24 pt-[92px] sm:pt-[100px]">
        <CheckoutForm />
      </main>
      <Footer />
    </div>
  );
}
