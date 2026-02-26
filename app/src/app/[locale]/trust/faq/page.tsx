import TrustPageShell from "@/components/trust/TrustPageShell";

const sections = ["SHOP", "PRESTA", "GP", "TIAK", "IMMO", "CARS"] as const;

export default async function TrustFaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  return (
    <TrustPageShell locale={locale} title="FAQ" subtitle={isFr ? "Questions frequentes par verticale (V0.1 placeholders)." : "Frequently asked questions by vertical (V0.1 placeholders)."}>
      <section className="grid gap-3">
        {sections.map((section) => (
          <details key={section} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
            <summary className="cursor-pointer text-sm font-semibold tracking-wide text-white">{section}</summary>
            <div className="mt-3 space-y-3 text-sm text-zinc-300">
              <p>{isFr ? `Comment fonctionne ${section} et quelles sont les conditions d'usage ? (placeholder)` : `How does ${section} work and what are the usage rules? (placeholder)`}</p>
              <p>{isFr ? "Que faire en cas de litige, retard ou fraude ? (placeholder)" : "What to do in case of dispute, delay or fraud? (placeholder)"}</p>
              <p>{isFr ? "Comment contacter le support et fournir des preuves ? (placeholder)" : "How to contact support and provide evidence? (placeholder)"}</p>
            </div>
          </details>
        ))}
      </section>
    </TrustPageShell>
  );
}
