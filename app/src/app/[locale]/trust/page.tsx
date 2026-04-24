import { Link } from "@/i18n/navigation";
import TrustPageShell from "@/components/trust/TrustPageShell";
import { trustHubCards } from "@/lib/legal";

export default async function TrustHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";

  return (
    <TrustPageShell
      locale={locale}
      title={isFr ? "Centre de confiance JONTAADO" : "JONTAADO Trust Center"}
      subtitle={
        isFr
          ? "CGU, annexes verticales, RGPD, cookies, moderation, securite et outils de signalement."
          : "Terms, vertical rules, privacy, cookies, moderation, security and reporting tools."
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trustHubCards.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 transition hover:border-white/20"
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
          </Link>
        ))}
      </section>
    </TrustPageShell>
  );
}

