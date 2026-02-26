import TrustPageShell from "@/components/trust/TrustPageShell";

export default async function TrustPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const sections = [
    { title: isFr ? "1. Donnees collectees" : "1. Data collected", body: isFr ? "Compte, transactions, support/moderation, journaux techniques et signaux de securite (placeholder)." : "Account, transaction, support/moderation, technical logs and security signals (placeholder)." },
    { title: isFr ? "2. Finalites" : "2. Purposes", body: isFr ? "Execution des services, prevention fraude, moderation, support client et obligations legales." : "Service delivery, fraud prevention, moderation, support and legal obligations." },
    { title: isFr ? "3. Conservation" : "3. Retention", body: isFr ? "Conservation selon type de donnees et obligations reglementaires (placeholder a preciser)." : "Retention depends on data type and regulatory obligations (placeholder to refine)." },
    { title: isFr ? "4. Droits utilisateurs" : "4. User rights", body: isFr ? "Acces, rectification, suppression, opposition et demandes support (placeholder workflow)." : "Access, rectification, deletion, objection and support requests (placeholder workflow)." },
  ];
  return (
    <TrustPageShell locale={locale} title={isFr ? "Confidentialite & politique de donnees" : "Privacy & data policy"}>
      <section className="space-y-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="text-sm text-zinc-300">{section.body}</p>
          </div>
        ))}
      </section>
    </TrustPageShell>
  );
}
