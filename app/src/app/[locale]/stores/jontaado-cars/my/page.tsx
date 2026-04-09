import type { Metadata } from "next";
import CarsStorePage from "@/components/cars/CarsStorePage";
import type { CarsStoreSearchParams } from "@/lib/carsStorefront";
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
    path: "/stores/jontaado-cars/my",
    title: isFr
      ? "Mes annonces JONTAADO CARS | Gestion vendeur"
      : "My JONTAADO CARS listings | Seller management",
    description: isFr
      ? "Gere tes annonces, tes credits et ton espace vendeur depuis JONTAADO CARS."
      : "Manage your listings, credits and seller space from JONTAADO CARS.",
    imagePath: "/stores/cars.png",
    noIndex: true,
  });
}

export default async function CarsMyStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CarsStoreSearchParams>;
}) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);

  return <CarsStorePage locale={locale} activeTab="my" searchParams={rawSearchParams} />;
}
