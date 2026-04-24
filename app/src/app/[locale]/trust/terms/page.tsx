import LegalDocumentView from "@/components/trust/LegalDocumentView";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { marketplaceTermsDocument } from "@/lib/legal";

export default async function TrustTermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <TrustPageShell
      locale={locale}
      title={marketplaceTermsDocument.title}
      subtitle={marketplaceTermsDocument.subtitle}
    >
      <LegalDocumentView locale={locale} document={marketplaceTermsDocument} />
    </TrustPageShell>
  );
}

