import { redirect } from "next/navigation";
import ImmoStorePage from "@/components/immo/ImmoStorePage";
import {
  buildImmoStoreHref,
  normalizeImmoStoreTab,
  type ImmoStoreSearchParams,
} from "@/lib/immoStorefront";

export default async function ImmoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ImmoStoreSearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const legacyTab = normalizeImmoStoreTab(filters.tab);

  if (filters.tab && legacyTab !== "explore") {
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
