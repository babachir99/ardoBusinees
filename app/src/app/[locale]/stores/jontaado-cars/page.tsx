import { redirect } from "next/navigation";
import CarsStorePage from "@/components/cars/CarsStorePage";
import {
  buildCarsStoreHref,
  normalizeCarsStoreTab,
  type CarsStoreSearchParams,
} from "@/lib/carsStorefront";

export default async function CarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CarsStoreSearchParams>;
}) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const legacyTab = normalizeCarsStoreTab(rawSearchParams.tab);

  if (rawSearchParams.tab && legacyTab !== "explore") {
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
