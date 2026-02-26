import TrustPageShell from "@/components/trust/TrustPageShell";
import TrustDisputeForm from "@/components/trust/TrustDisputeForm";

export default async function TrustDisputesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  return (
    <TrustPageShell locale={locale} title={isFr ? "Deposer une plainte" : "Submit a dispute"} subtitle={isFr ? "Formulaire centralise V0.1 pour les litiges par verticale." : "Centralized V0.1 form for vertical disputes."}>
      <TrustDisputeForm locale={locale} />
    </TrustPageShell>
  );
}
