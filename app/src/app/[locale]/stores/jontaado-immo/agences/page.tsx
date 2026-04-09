import type { Metadata } from "next";
import ImmoStorePage from "@/components/immo/ImmoStorePage";
import type { ImmoStoreSearchParams } from "@/lib/immoStorefront";
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
    path: "/stores/jontaado-immo/agences",
    title: isFr
      ? "Agences JONTAADO IMMO | Reseau immobilier"
      : "JONTAADO IMMO Agencies | Real estate network",
    description: isFr
      ? "Retrouve les agences immobilieres JONTAADO IMMO, leurs profils verifies et leurs annonces publiees."
      : "Browse JONTAADO IMMO agencies, verified profiles and their published listings.",
    imagePath: "/stores/immo.png",
  });
}

export default async function ImmoAgenciesStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ImmoStoreSearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);

  return <ImmoStorePage locale={locale} activeTab="agencies" searchParams={filters} />;
}
