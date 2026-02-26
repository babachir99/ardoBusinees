import Footer from "@/components/layout/Footer";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

export default function TrustPageShell({
  locale,
  title,
  subtitle,
  children,
}: {
  locale: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24 pt-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-300/10 via-zinc-900 to-zinc-900 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                {locale === "fr" ? "Centre de confiance" : "Trust Center"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
              {subtitle ? <p className="mt-2 text-sm text-zinc-300">{subtitle}</p> : null}
            </div>
            <Link href="/trust" className="inline-flex rounded-full border border-white/15 bg-zinc-900/70 px-4 py-2 text-xs font-semibold text-zinc-100 hover:border-white/30">
              {locale === "fr" ? "Hub Trust" : "Trust hub"}
            </Link>
          </div>
        </section>
        {children}
      </main>
      <Footer />
    </div>
  );
}
