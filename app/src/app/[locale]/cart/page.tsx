import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import CartView from "@/components/cart/CartView";
import { useTranslations } from "next-intl";
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
    path: "/cart",
    title: isFr ? "Panier | Espace prive" : "Cart | Private space",
    description: isFr
      ? "Retrouve les produits ajoutes a ton panier dans ton espace prive."
      : "Review the products added to your cart in your private space.",
    imagePath: "/logo.png",
    noIndex: true,
  });
}

export default function CartPage() {
  const t = useTranslations("Cart");
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
          href="/shop"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.shop")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24">
        <CartView />
      </main>
      <Footer />
    </div>
  );
}
