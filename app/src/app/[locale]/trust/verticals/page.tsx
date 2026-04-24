import LegalDocumentView from "@/components/trust/LegalDocumentView";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { verticalTermsDocument } from "@/lib/legal";

export default async function TrustVerticalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <TrustPageShell
      locale={locale}
      title={verticalTermsDocument.title}
      subtitle={verticalTermsDocument.subtitle}
    >
      <LegalDocumentView locale={locale} document={verticalTermsDocument} />
    </TrustPageShell>
  );
}

