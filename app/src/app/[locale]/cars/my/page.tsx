import { redirect } from "next/navigation";
import { buildCarsStoreHref } from "@/lib/carsStorefront";

export default async function CarsMyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(buildCarsStoreHref(locale, { tab: "my", includeLocale: true }));
}
