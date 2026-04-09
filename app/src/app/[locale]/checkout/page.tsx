import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import CheckoutForm from "@/components/cart/CheckoutForm";
import Image from "next/image";
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

export default function CheckoutPage() {
  const t = useTranslations("Checkout");

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
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
        <Link
          href="/cart"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.cart")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24">
        <CheckoutForm />
      </main>
      <Footer />
    </div>
  );
}
