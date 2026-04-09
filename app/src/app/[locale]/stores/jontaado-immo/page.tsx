import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ImmoStorePage from "@/components/immo/ImmoStorePage";
import {
  buildImmoStoreHref,
  normalizeImmoStoreTab,
  type ImmoStoreSearchParams,
} from "@/lib/immoStorefront";
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
    path: "/stores/jontaado-immo",
    title: isFr
      ? "JONTAADO IMMO | Annonces immobilieres, agences et espace annonceur"
      : "JONTAADO IMMO | Real estate listings, agencies and owner space",
    description: isFr
      ? "Explore les annonces immobilieres, decouvre les agences et gere tes biens depuis la verticale JONTAADO IMMO."
      : "Explore real estate listings, browse agencies and manage your properties from the JONTAADO IMMO vertical.",
    imagePath: "/stores/immo.png",
  });
}

export default async function ImmoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ImmoStoreSearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const legacyTab = normalizeImmoStoreTab(filters.tab);

  if (filters.tab) {
    redirect(
      buildImmoStoreHref(locale, {
        tab: legacyTab,
        params: filters,
        includeLocale: true,
      })
    );
  }

  return <ImmoStorePage locale={locale} activeTab="explore" searchParams={filters} />;
}
