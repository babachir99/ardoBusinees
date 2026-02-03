import { Link } from "@/i18n/navigation";
import CartView from "@/components/cart/CartView";
import { useTranslations } from "next-intl";

export default function CartPage() {
  const t = useTranslations("Cart");
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ardoBusiness
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
    </div>
  );
}
