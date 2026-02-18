import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import TiakStoreClient from "@/components/tiak/TiakStoreClient";
import { authOptions } from "@/lib/auth";

export default async function TiakTiakPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

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
          {locale === "fr" ? "Retour aux boutiques" : "Back to stores"}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-300/15 via-zinc-900 to-zinc-900 p-8 card-glow fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">JONTAADO TIAK TIAK</p>
          <h1 className="mt-3 text-2xl font-semibold md:text-4xl">
            {locale === "fr" ? "Livraison locale express" : "Fast local delivery"}
          </h1>
          <p className="mt-3 text-sm text-zinc-300">
            {locale === "fr"
              ? "Test V0: demande de livraison, prise en charge courier et preuves de livraison."
              : "V0 test: delivery requests, courier acceptance and proof events."}
          </p>
        </section>

        <TiakStoreClient
          locale={locale}
          isLoggedIn={Boolean(session?.user?.id)}
          currentUserId={session?.user?.id ?? null}
          currentUserRole={session?.user?.role ?? null}
        />
      </main>

      <Footer />
    </div>
  );
}
