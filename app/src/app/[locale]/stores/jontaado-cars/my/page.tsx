import CarsStorePage from "@/components/cars/CarsStorePage";
import type { CarsStoreSearchParams } from "@/lib/carsStorefront";

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
