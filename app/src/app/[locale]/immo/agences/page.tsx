import { redirect } from "next/navigation";
import { buildImmoStoreHref, mapLegacyAgencySearchToStoreParams } from "@/lib/immoStorefront";

export default async function ImmoAgenciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; city?: string; verified?: string }>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);

  redirect(
    buildImmoStoreHref(locale, {
      tab: "agencies",
      params: mapLegacyAgencySearchToStoreParams(filters),
      includeLocale: true,
    })
  );
}
