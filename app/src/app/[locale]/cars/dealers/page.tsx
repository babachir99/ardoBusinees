import { redirect } from "next/navigation";
import {
  buildCarsStoreHref,
  mapLegacyDealerSearchToStoreParams,
} from "@/lib/carsStorefront";

type SearchParams = {
  country?: string;
  city?: string;
  verified?: string;
  take?: string;
};

export default async function CarsDealersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  redirect(
    buildCarsStoreHref(locale, {
      tab: "dealers",
      params: mapLegacyDealerSearchToStoreParams(filters),
    })
  );
}
