import TrustPageShell from "@/components/trust/TrustPageShell";
import UserSafetyActions from "@/components/trust/UserSafetyActions";

export default async function TrustSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  return (
    <TrustPageShell locale={locale} title={isFr ? "Securite & signalements" : "Security & reporting"} subtitle={isFr ? "Bonnes pratiques compte/paiement + blocage / signalement (V0.1)." : "Account/payment best practices + blocking/reporting (V0.1)."}>
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300">
          <div>
            <h2 className="text-lg font-semibold text-white">{isFr ? "Bonnes pratiques" : "Best practices"}</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>{isFr ? "Ne partagez jamais codes OTP, mot de passe ou infos carte en message." : "Never share OTP codes, passwords or card details in chat."}</li>
              <li>{isFr ? "Utilisez les paiements integres et gardez vos preuves (capture, reference, timeline)." : "Use integrated payments and keep evidence (screenshots, references, timelines)."}</li>
              <li>{isFr ? "Signalez les comptes suspects et deposez une plainte si un litige apparait." : "Report suspicious accounts and open a dispute when a conflict occurs."}</li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{isFr ? "Blocage utilisateur (V0.1)" : "User blocking (V0.1)"}</h2>
            <p className="mt-2">{isFr ? "Le composant ci-contre est reutilisable sur des pages profil/detail pour bloquer ou debloquer un utilisateur." : "The component on the side is reusable on profile/detail pages to block or unblock a user."}</p>
            <p className="mt-2 text-xs text-zinc-500">{isFr ? "Exemple avec userId placeholder. Remplacez par un vrai userId dans une integration de page profil." : "Demo with a placeholder userId. Replace with a real userId on a profile page integration."}</p>
          </div>
        </div>
        <UserSafetyActions userId="placeholder-user-id" locale={locale} />
      </section>
    </TrustPageShell>
  );
}
