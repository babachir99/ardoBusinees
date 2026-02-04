import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import Footer from "@/components/layout/Footer";

export default async function TiakTiakPage() {
  const t = await getTranslations("Verticals.tiak");

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
          href="/stores"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {t("back")}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-300/15 via-zinc-900 to-zinc-900 p-10 card-glow fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            {t("kicker")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">{t("subtitle")}</p>
        </section>

        <section className="grid gap-6 md:grid-cols-3 fade-up">
          {t.raw("features").map((feature: string, index: number) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6"
            >
              <p className="text-sm text-zinc-200">{feature}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
