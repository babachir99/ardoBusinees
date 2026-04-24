import LegalDocumentView from "@/components/trust/LegalDocumentView";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { cookiesDocument } from "@/lib/legal";

export default async function TrustCookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <TrustPageShell
      locale={locale}
      title={cookiesDocument.title}
      subtitle={cookiesDocument.subtitle}
    >
      <LegalDocumentView locale={locale} document={cookiesDocument} />
    </TrustPageShell>
  );
}

