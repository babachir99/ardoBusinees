import { redirect } from "next/navigation";
import {
  buildImmoStoreHref,
  mapLegacyImmoSearchToStoreParams,
  type ImmoStoreSearchParams,
} from "@/lib/immoStorefront";

export default async function ImmoListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ImmoStoreSearchParams>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);

  redirect(
    buildImmoStoreHref(locale, {
      tab: "explore",
      params: mapLegacyImmoSearchToStoreParams(filters),
      includeLocale: true,
    })
  );
}
