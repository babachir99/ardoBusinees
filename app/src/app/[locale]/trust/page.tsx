import { Link } from "@/i18n/navigation";
import TrustPageShell from "@/components/trust/TrustPageShell";

const cardPaths = [
  { key: "faq", href: "/trust/faq" },
  { key: "terms", href: "/trust/terms" },
  { key: "privacy", href: "/trust/privacy" },
  { key: "security", href: "/trust/security" },
  { key: "disputes", href: "/trust/disputes" },
  { key: "report", href: "/trust/report" },
] as const;

export default async function TrustHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const labels: Record<string, { title: string; body: string }> = {
    faq: { title: "FAQ", body: isFr ? "Questions frequentes par verticale." : "Frequently asked questions by vertical." },
    terms: { title: isFr ? "Conditions" : "Terms", body: isFr ? "Regles et responsabilites de la plateforme." : "Platform rules and responsibilities." },
    privacy: { title: isFr ? "Confidentialite" : "Privacy", body: isFr ? "Politique de donnees et droits utilisateurs (placeholder)." : "Data policy and user rights (placeholder)." },
    security: { title: isFr ? "Securite" : "Security", body: isFr ? "Comptes, paiements, signalements et blocages." : "Accounts, payments, reports and blocking." },
    disputes: { title: isFr ? "Plaintes" : "Disputes", body: isFr ? "Soumettre un litige ou une plainte support/moderation." : "Submit a complaint/dispute to support/moderation." },
    report: { title: isFr ? "Signaler" : "Report", body: isFr ? "Signaler un compte ou comportement suspect." : "Report an account or suspicious behavior." },
  };

  return (
    <TrustPageShell locale={locale} title={isFr ? "Centre de confiance JONTAADO" : "JONTAADO Trust Center"} subtitle={isFr ? "Aide, FAQ, regles, confidentialite, securite et outils de moderation." : "Help, FAQ, rules, privacy, security and moderation tools."}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cardPaths.map((item) => (
          <Link key={item.key} href={item.href} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 hover:border-white/20">
            <h2 className="text-lg font-semibold">{labels[item.key].title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{labels[item.key].body}</p>
          </Link>
        ))}
      </section>
    </TrustPageShell>
  );
}
