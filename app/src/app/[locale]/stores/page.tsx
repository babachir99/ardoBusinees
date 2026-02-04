import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import Footer from "@/components/layout/Footer";

export default async function StoresPage() {
  const t = await getTranslations("Stores");
  const stores = await prisma.store.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

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
          {t("shop")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/15 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            {t("kicker")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">{t("subtitle")}</p>
        </section>

        <section className="grid gap-6 md:grid-cols-2 fade-up">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.slug}`}
              className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 transition hover:border-emerald-300/60"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                {store.type}
              </p>
              <h2 className="mt-4 text-xl font-semibold">{store.name}</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {store.description ?? t("defaultDesc")}
              </p>
              <div className="mt-6 text-xs text-emerald-200">
                {t("view")}
              </div>
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
