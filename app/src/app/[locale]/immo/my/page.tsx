import { redirect } from "next/navigation";
import { buildImmoStoreHref } from "@/lib/immoStorefront";

export default async function ImmoMyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect(
    buildImmoStoreHref(locale, {
      tab: "my",
      includeLocale: true,
    })
  );
}
