import LegalDocumentView from "@/components/trust/LegalDocumentView";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { moderationDocument } from "@/lib/legal";

export default async function TrustModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <TrustPageShell
      locale={locale}
      title={moderationDocument.title}
      subtitle={moderationDocument.subtitle}
    >
      <LegalDocumentView locale={locale} document={moderationDocument} />
    </TrustPageShell>
  );
}

