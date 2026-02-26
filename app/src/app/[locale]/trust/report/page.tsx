import TrustPageShell from "@/components/trust/TrustPageShell";
import TrustReportForm from "@/components/trust/TrustReportForm";

export default async function TrustReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  return (
    <TrustPageShell locale={locale} title={isFr ? "Signaler un compte" : "Report an account"} subtitle={isFr ? "Remontez spam, fraude, abus ou comportement suspect a l'admin." : "Report spam, fraud, abuse or suspicious behavior to admin."}>
      <TrustReportForm locale={locale} />
    </TrustPageShell>
  );
}
