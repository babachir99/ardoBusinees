import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import CheckoutSummary from "@/components/cart/CheckoutSummary";

export default function CheckoutPage() {
  const t = useTranslations("Checkout");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ardoBusiness
        </Link>
        <Link
          href="/cart"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("nav.cart")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24 md:flex-row">
        <section className="flex-1 rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-3 text-sm text-zinc-300">{t("subtitle")}</p>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
              <p className="text-sm font-semibold">{t("form.contact")}</p>
              <div className="mt-4 grid gap-3 text-xs text-zinc-400">
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3">
                  {t("form.email")}
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3">
                  {t("form.phone")}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
              <p className="text-sm font-semibold">{t("form.shipping")}</p>
              <div className="mt-4 grid gap-3 text-xs text-zinc-400">
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3">
                  {t("form.address")}
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3">
                  {t("form.city")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <CheckoutSummary />
      </main>
    </div>
  );
}
