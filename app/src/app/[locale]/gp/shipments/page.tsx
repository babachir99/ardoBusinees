import Image from "next/image";
import { getServerSession } from "next-auth";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import { authOptions } from "@/lib/auth";
import GpShipmentsTimelineClient from "@/components/gp/GpShipmentsTimelineClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canAccess(role: string | undefined) {
  return ["ADMIN", "TRANSPORTER", "GP_CARRIER", "TRAVELER"].includes(role ?? "");
}

export default async function GpShipmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !canAccess(session.user.role)) {
    return (
      <div className="min-h-screen bg-jonta text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
            <h1 className="text-2xl font-semibold">
              {locale === "fr" ? "Acces GP requis" : "GP access required"}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              {locale === "fr"
                ? "Cette page est reservee aux transporteurs GP."
                : "This page is reserved for GP transporters."}
            </p>
            <Link
              href="/stores/jontaado-gp"
              className="mt-6 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
            >
              {locale === "fr" ? "Retour a GP" : "Back to GP"}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
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
        <div className="flex items-center gap-2">
          <Link
            href="/stores/jontaado-gp"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
          >
            {locale === "fr" ? "Voir GP" : "Go to GP"}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-300/15 via-zinc-900 to-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">JONTAADO GP</p>
          <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
            {locale === "fr" ? "Timeline shipments" : "Shipments timeline"}
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            {locale === "fr"
              ? "Suivi des shipments actifs avec timeline de tracking."
              : "Track active shipments and view timeline events."}
          </p>
        </section>

        <GpShipmentsTimelineClient locale={locale} />
      </main>

      <Footer />
    </div>
  );
}
