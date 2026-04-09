import { redirect } from "next/navigation";
import {
  buildCarsStoreHref,
  mapLegacyCarsSearchToStoreParams,
  type CarsStoreSearchParams,
} from "@/lib/carsStorefront";

export default async function CarsListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CarsStoreSearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  redirect(
    buildCarsStoreHref(locale, {
      tab: "explore",
      params: mapLegacyCarsSearchToStoreParams(filters),
      includeLocale: true,
    })
  );
}
