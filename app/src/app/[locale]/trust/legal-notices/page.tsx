import LegalDocumentView from "@/components/trust/LegalDocumentView";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { legalNoticesDocument } from "@/lib/legal";

export default async function TrustLegalNoticesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <TrustPageShell
      locale={locale}
      title={legalNoticesDocument.title}
      subtitle={legalNoticesDocument.subtitle}
    >
      <LegalDocumentView locale={locale} document={legalNoticesDocument} />
    </TrustPageShell>
  );
}

