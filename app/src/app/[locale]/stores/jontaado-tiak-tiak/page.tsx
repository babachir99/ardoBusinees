import { getTranslations } from "next-intl/server";
import VerticalStorefront from "@/components/stores/VerticalStorefront";

export default async function TiakTiakPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ locale }, { category }] = await Promise.all([params, searchParams]);
  const t = await getTranslations("Verticals.tiak");

  const rawFeatures = t.raw("features");
  const features = Array.isArray(rawFeatures)
    ? rawFeatures.map((item) => String(item))
    : [];

  return (
    <VerticalStorefront
      locale={locale}
      storeSlug="jontaado-tiak-tiak"
      categoryFilter={category}
      backLabel={t("back")}
      hero={{
        kicker: t("kicker"),
        title: t("title"),
        subtitle: t("subtitle"),
        features,
      }}
      role={{
        target: "COURIER",
        ctaActive:
          locale === "fr" ? "Acceder a mon espace Tiak Tiak" : "Open my Tiak Tiak workspace",
        ctaInactive:
          locale === "fr" ? "Devenir livreur Tiak Tiak" : "Become a Tiak Tiak courier",
      }}
      theme={{
        gradientFromClass: "from-emerald-300/15",
        kickerClass: "text-emerald-200",
        accentClass: "text-emerald-200",
      }}
    />
  );
}
