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
    path: "/stores/jontaado-cars/dealers",
    title: isFr
      ? "Concessionnaires JONTAADO CARS | Reseau auto"
      : "JONTAADO CARS Dealers | Auto network",
    description: isFr
      ? "Retrouve les concessionnaires JONTAADO CARS, leurs profils verifies et leurs vehicules publies."
      : "Browse JONTAADO CARS dealers, verified profiles and their published vehicles.",
    imagePath: "/stores/cars.png",
  });
}

export default async function CarsDealersStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CarsStoreSearchParams>;
}) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);

  return <CarsStorePage locale={locale} activeTab="dealers" searchParams={rawSearchParams} />;
}
