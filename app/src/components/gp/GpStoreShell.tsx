import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import MarketplaceActions, {
  marketplaceActionPrimaryClass,
  marketplaceActionSecondaryClass,
} from "@/components/marketplace/MarketplaceActions";

type SectionKey = "home" | "dashboard" | "shipments";

type Props = {
  locale: string;
  title: string;
  description: string;
  activeSection?: SectionKey;
  topAction?: ReactNode;
  children: ReactNode;
};

function resolveClass(active: boolean) {
  return active ? marketplaceActionPrimaryClass : marketplaceActionSecondaryClass;
}

export default async function GpStoreShell({
  locale,
  title,
  description,
  activeSection = "home",
  topAction,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-cyan-300/14 via-zinc-900/92 to-zinc-950 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.22)]">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">JONTAADO GP</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-semibold text-white md:text-3xl">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
            </div>
            {topAction ? <div className="flex items-center gap-2">{topAction}</div> : null}
          </div>
        </section>

        <MarketplaceActions
          left={
            <>
              <Link href="/stores/jontaado-gp" className={resolveClass(activeSection === "home")}>
                {locale === "fr" ? "Explorer" : "Explore"}
              </Link>
              <Link
                href="/stores/jontaado-gp/dashboard"
                className={resolveClass(activeSection === "dashboard")}
              >
                {locale === "fr" ? "Dashboard" : "Dashboard"}
              </Link>
              <Link
                href="/stores/jontaado-gp/shipments"
                className={resolveClass(activeSection === "shipments")}
              >
                {locale === "fr" ? "Shipments" : "Shipments"}
              </Link>
            </>
          }
        />

        {children}
      </main>

      <Footer />
    </div>
  );
}
