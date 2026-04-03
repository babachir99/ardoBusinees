import Image from "next/image";
import { Link } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";

const copy = {
  fr: {
    back: "Retour aux boutiques",
    kicker: "JONTAADO CARES",
    title: "Donner. Soutenir. Changer des vies.",
    subtitle:
      "La verticale solidaire de JONTAADO reunira les dons, les cagnottes, l'entraide locale et le suivi d'impact dans une experience de confiance, claire et actionnable.",
    badge: "Verticale en preparation",
    specKicker: "Cahier de reference",
    specTitle: "Un produit pense comme une vraie plateforme solidaire",
    specBody:
      "Paiements securises, moderation, IA utile, suivi d'impact et back-office admin: la base fonctionnelle est deja bien definie.",
    chips: ["Dons", "Cagnottes", "Entraide", "Impact", "Transparence"],
    metrics: [
      { value: "4", label: "Piliers coeur", detail: "Dons, cagnottes, entraide, impact" },
      { value: "24/7", label: "Moderation ciblee", detail: "Signalements, controles et validation" },
      { value: "IA", label: "Aide terrain", detail: "Matching, detection et recommandations" },
    ],
    modulesTitle: "Ce que JONTAADO CARES doit rendre simple",
    modulesSubtitle:
      "Chaque module est pense pour inspirer confiance, faciliter l'action et garder une lecture claire de l'impact.",
    modules: [
      {
        title: "Dons solidaires",
        description: "Dons uniques ou recurrents vers des causes verifiees avec categories, justificatifs et parcours rapide.",
      },
      {
        title: "Cagnottes a impact",
        description: "Campagnes pour projets, urgences ou entraide locale avec objectifs, progression et preuves d'usage.",
      },
      {
        title: "Entraide locale",
        description: "Demandes d'aide, besoins de terrain et mobilisation de volontaires, voisins, associations ou ONG.",
      },
      {
        title: "Transparence & impact",
        description: "Suivi des fonds, pieces justificatives, rapports terrain et mesure concrete de l'impact genere.",
      },
      {
        title: "Paiements & securite",
        description: "PayDunya, fonds securises, validation conditionnelle, anti-fraude et garde-fous de conformite.",
      },
      {
        title: "IA solidaire",
        description: "Matching intelligent, recommandations, aide a la redaction et priorisation des demandes sensibles.",
      },
    ],
    journeyTitle: "Un parcours plus humain et plus fiable",
    journey: [
      {
        step: "01",
        title: "Publier une cause ou un besoin",
        description: "Campagne, appel a dons ou demande d'entraide avec contexte, preuves et objectif clair.",
      },
      {
        step: "02",
        title: "Recevoir du soutien",
        description: "Dons, partage, mobilisation locale et recommandations intelligentes pour accelerer la mise en relation.",
      },
      {
        step: "03",
        title: "Suivre les etapes",
        description: "Progression, mises a jour, validation admin et pieces de transparence pour rassurer tout le monde.",
      },
      {
        step: "04",
        title: "Mesurer l'impact",
        description: "Resultats, remerciements, historique d'impact et boucle de confiance pour les prochaines actions.",
      },
    ],
    audienceTitle: "Pour qui ?",
    audienceSubtitle: "Une meme plateforme pour tous les acteurs de la solidarite.",
    audience: ["Donateurs", "Beneficiaires", "Createurs de cagnottes", "Associations & ONG", "Volontaires", "Admins / moderation"],
    opsTitle: "Socle confiance & operations",
    ops: [
      "Paiement via PayDunya",
      "Fonds securises et validation conditionnelle",
      "Conformite & lutte anti-fraude",
      "Back-office de moderation et statistiques",
      "Suivi des transactions et demandes d'aide",
      "Tableaux de bord impact / geographie / usage",
    ],
    aiTitle: "IA au service de la solidarite",
    ai: [
      "Matching intelligent entre besoins, projets et donateurs",
      "Detection de fraudes et analyse de comportements suspects",
      "Recommandations personnalisees pour renforcer l'engagement",
      "Aide a la redaction et au suivi des campagnes",
    ],
    roadmapTitle: "Direction produit",
    roadmapBody:
      "On a deja une base tres claire: une verticale simple a comprendre, tres credible et orientee confiance. La prochaine etape sera de transformer ce cadre en experience premium et ultra-guidante.",
    roadmapCta: "Revenir aux univers JONTAADO",
  },
  en: {
    back: "Back to stores",
    kicker: "JONTAADO CARES",
    title: "Give. Support. Change lives.",
    subtitle:
      "JONTAADO's solidarity vertical brings donations, campaigns, local mutual aid and impact tracking into one trusted, actionable experience.",
    badge: "Vertical in progress",
    specKicker: "Reference brief",
    specTitle: "A real solidarity product, not just a landing page",
    specBody:
      "Secure payments, moderation, useful AI, impact tracking and admin tooling are already part of the product direction.",
    chips: ["Donations", "Campaigns", "Mutual aid", "Impact", "Transparency"],
    metrics: [
      { value: "4", label: "Core pillars", detail: "Donations, campaigns, aid, impact" },
      { value: "24/7", label: "Targeted moderation", detail: "Flags, controls and validation" },
      { value: "AI", label: "Field assistance", detail: "Matching, detection and recommendations" },
    ],
    modulesTitle: "What JONTAADO CARES should make effortless",
    modulesSubtitle:
      "Every module is designed to build trust, simplify action and keep impact readable for everyone involved.",
    modules: [
      {
        title: "Solidarity donations",
        description: "One-time or recurring donations for verified causes with categories, proof and a fast trusted flow.",
      },
      {
        title: "Impact campaigns",
        description: "Fundraisers for projects, emergencies or local aid with goals, progress and usage proof.",
      },
      {
        title: "Local assistance",
        description: "Help requests and local mobilization for volunteers, associations, NGOs and neighbors.",
      },
      {
        title: "Transparency & impact",
        description: "Fund tracking, supporting documents, field updates and measurable outcomes.",
      },
      {
        title: "Payments & security",
        description: "PayDunya, secured funds, conditional release, anti-fraud and compliance guardrails.",
      },
      {
        title: "Solidarity AI",
        description: "Smart matching, recommendations, writing assistance and prioritization of sensitive needs.",
      },
    ],
    journeyTitle: "A more human, more reliable journey",
    journey: [
      {
        step: "01",
        title: "Publish a cause or request",
        description: "Campaign, donation drive or mutual-aid request with context, proof and a clear objective.",
      },
      {
        step: "02",
        title: "Receive support",
        description: "Donations, sharing, local mobilization and intelligent recommendations to speed up matching.",
      },
      {
        step: "03",
        title: "Track progress",
        description: "Updates, admin validation and transparency proof to keep everyone reassured.",
      },
      {
        step: "04",
        title: "Measure impact",
        description: "Results, thanks, impact history and a stronger trust loop for future initiatives.",
      },
    ],
    audienceTitle: "Who is it for?",
    audienceSubtitle: "One platform for the full solidarity ecosystem.",
    audience: ["Donors", "Beneficiaries", "Campaign creators", "Associations & NGOs", "Volunteers", "Admins / moderation"],
    opsTitle: "Trust & operations foundation",
    ops: [
      "PayDunya payments",
      "Secured funds and conditional validation",
      "Compliance and anti-fraud controls",
      "Moderation back office and analytics",
      "Tracking of transactions and help requests",
      "Impact / geography / usage dashboards",
    ],
    aiTitle: "AI in service of solidarity",
    ai: [
      "Smart matching between needs, projects and donors",
      "Fraud detection and suspicious behavior analysis",
      "Personalized recommendations to deepen engagement",
      "Writing assistance and campaign follow-up",
    ],
    roadmapTitle: "Product direction",
    roadmapBody:
      "The foundation is already clear: a solidarity vertical that feels credible, easy to grasp and trust-first. The next step is turning that structure into a premium, guided experience.",
    roadmapCta: "Back to JONTAADO universes",
  },
} as const;

export default async function JontaadoCaresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const content = copy[isFr ? "fr" : "en"];

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 fade-up">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={140}
            height={140}
            className="h-[115px] w-auto md:h-[135px]"
            priority
          />
        </Link>
        <Link
          href="/stores"
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/60"
        >
          {content.back}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.2),_transparent_35%),linear-gradient(135deg,rgba(16,24,39,0.98),rgba(10,14,19,0.98))] p-6 shadow-[0_25px_90px_-45px_rgba(34,197,94,0.45)] md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-stretch">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                    {content.kicker}
                  </p>
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                    {content.badge}
                  </span>
                </div>

                <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
                  {content.title}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
                  {content.subtitle}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {content.chips.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-emerald-300/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {content.metrics.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-4"
                  >
                    <p className="text-2xl font-semibold text-emerald-200">{item.value}</p>
                    <p className="mt-2 text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr] xl:grid-cols-1">
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5">
                  <Image
                    src="/stores/cares.png"
                    alt="JONTAADO CARES logo"
                    width={720}
                    height={320}
                    className="mx-auto h-auto w-full max-w-[320px] object-contain"
                    priority
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-zinc-950/65 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                    {content.specKicker}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">{content.specTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{content.specBody}</p>
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-white/10 bg-zinc-900/65 p-5 backdrop-blur-sm">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-2 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.45)]">
                  <Image
                    src="/stores/cares-spec.png"
                    alt="Cahier des charges JONTAADO CARES"
                    width={1200}
                    height={1700}
                    className="h-auto w-full rounded-xl object-cover"
                  />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                {content.modulesTitle}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
                {content.modulesSubtitle}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.modules.map((item) => (
              <article
                key={item.title}
                className="group rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:shadow-[0_18px_50px_-35px_rgba(34,197,94,0.45)]"
              >
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
              {content.journeyTitle}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {content.journey.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5"
                >
                  <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-emerald-100">
                    {item.step}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{item.description}</p>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-6">
            <article className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                {content.audienceTitle}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{content.audienceSubtitle}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {content.audience.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(16,24,39,0.92),rgba(7,17,12,0.96))] p-6 shadow-[0_20px_70px_-45px_rgba(34,197,94,0.5)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                {content.roadmapTitle}
              </p>
              <p className="mt-4 text-sm leading-7 text-zinc-200">{content.roadmapBody}</p>
              <Link
                href="/stores"
                className="mt-6 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-400/15"
              >
                {content.roadmapCta}
              </Link>
            </article>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
              {content.opsTitle}
            </p>
            <ul className="mt-5 space-y-3 text-sm text-zinc-300">
              {content.ops.map((item) => (
                <li key={item} className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 leading-6">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-zinc-900/65 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
              {content.aiTitle}
            </p>
            <ul className="mt-5 space-y-3 text-sm text-zinc-300">
              {content.ai.map((item) => (
                <li key={item} className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 leading-6">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </main>

      <Footer />
    </div>
  );
}
