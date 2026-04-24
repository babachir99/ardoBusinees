import LegalDocumentView from "@/components/trust/LegalDocumentView";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { privacyDocument } from "@/lib/legal";

export default async function TrustPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <TrustPageShell
      locale={locale}
      title={privacyDocument.title}
      subtitle={privacyDocument.subtitle}
    >
      <LegalDocumentView locale={locale} document={privacyDocument} />
    </TrustPageShell>
  );
}

