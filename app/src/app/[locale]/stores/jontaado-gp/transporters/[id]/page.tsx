import type { Metadata } from "next";
import TransporterProfilePage from "@/app/[locale]/transporters/[id]/page";
import { buildStoreMetadata } from "@/lib/storeSeo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const isFr = locale === "fr";

  return buildStoreMetadata({
    locale,
    path: `/stores/jontaado-gp/transporters/${id}`,
    title: isFr ? "Profil transporteur GP | JONTAADO" : "GP transporter profile | JONTAADO",
    description: isFr
      ? "Consulte le profil public d'un transporteur GP, ses trajets actifs et les avis laisses par la communaute."
      : "Explore a GP transporter's public profile, active trips and community reviews.",
    imagePath: "/stores/gp.png",
  });
}

export default TransporterProfilePage;
