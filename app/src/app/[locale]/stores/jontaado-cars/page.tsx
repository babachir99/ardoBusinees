import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CarsStorePage from "@/components/cars/CarsStorePage";
import {
  buildCarsStoreHref,
  normalizeCarsStoreTab,
  type CarsStoreSearchParams,
} from "@/lib/carsStorefront";
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
    path: "/stores/jontaado-cars",
    title: isFr
      ? "JONTAADO CARS | Annonces voitures, concessionnaires et espace vendeur"
      : "JONTAADO CARS | Car listings, dealers and seller space",
    description: isFr
      ? "Explore les annonces voitures, decouvre les concessionnaires et gere tes annonces depuis la verticale JONTAADO CARS."
      : "Explore car listings, browse dealers and manage your listings from the JONTAADO CARS vertical.",
    imagePath: "/stores/cars.png",
  });
}

export default async function CarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CarsStoreSearchParams>;
}) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const legacyTab = normalizeCarsStoreTab(rawSearchParams.tab);

  if (rawSearchParams.tab) {
    redirect(
      buildCarsStoreHref(locale, {
        tab: legacyTab,
        params: rawSearchParams,
        includeLocale: true,
      })
    );
  }

  return <CarsStorePage locale={locale} activeTab="explore" searchParams={rawSearchParams} />;
}
