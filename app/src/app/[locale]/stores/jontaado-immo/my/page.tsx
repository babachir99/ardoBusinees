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
    path: "/stores/jontaado-immo/my",
    title: isFr
      ? "Mes annonces JONTAADO IMMO | Gestion immobilier"
      : "My JONTAADO IMMO listings | Real estate management",
    description: isFr
      ? "Gere tes annonces, tes credits et ton espace immobilier depuis JONTAADO IMMO."
      : "Manage your listings, credits and real estate space from JONTAADO IMMO.",
    imagePath: "/stores/immo.png",
  });
}

export default async function ImmoMyStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ImmoStoreSearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);

  return <ImmoStorePage locale={locale} activeTab="my" searchParams={filters} />;
}
