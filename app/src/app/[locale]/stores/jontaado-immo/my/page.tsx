import ImmoStorePage from "@/components/immo/ImmoStorePage";
import type { ImmoStoreSearchParams } from "@/lib/immoStorefront";

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
