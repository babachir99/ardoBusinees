import TrustPageShell from "@/components/trust/TrustPageShell";

export default async function TrustTermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const sections = [
    { title: isFr ? "1. Objet" : "1. Purpose", body: isFr ? "Conditions generales d'utilisation de JONTAADO (placeholder V0.1, revue juridique requise)." : "General terms of use for JONTAADO (V0.1 placeholder, legal review required)." },
    { title: isFr ? "2. Comptes et roles" : "2. Accounts and roles", body: isFr ? "Les comptes doivent rester exacts, securises et conformes aux roles/verticales autorises." : "Accounts must remain accurate, secure and consistent with allowed roles/verticals." },
    { title: isFr ? "3. Contenus et annonces" : "3. Content and listings", body: isFr ? "Interdiction des contenus illicites, fraude, usurpation et spam. Les contenus peuvent etre moderes." : "Illegal content, fraud, impersonation and spam are prohibited. Content may be moderated." },
    { title: isFr ? "4. Litiges et moderation" : "4. Disputes and moderation", body: isFr ? "JONTAADO peut suspendre comptes/contenus, exiger des preuves et traiter les plaintes signalements." : "JONTAADO may suspend accounts/content, request evidence and process disputes/reports." },
  ];
  return (
    <TrustPageShell locale={locale} title={isFr ? "Conditions d'utilisation" : "Terms of use"}>
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
