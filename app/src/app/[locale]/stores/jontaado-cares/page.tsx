import Footer from "@/components/layout/Footer";
import AppHeader from "@/components/layout/AppHeader";
import CaresProductExperience, {
  type CaresPageContent,
} from "@/components/cares/CaresProductExperience";

const content: Record<"fr" | "en", CaresPageContent & { back: string }> = {
  fr: {
    back: "Retour aux boutiques",
    kicker: "JONTAADO CARES",
    title: "Donner, offrir ou demander de l'aide dans une experience simple et rassurante.",
    subtitle:
      "CARES doit ressembler a une verticale claire: je peux faire un don, lancer une cagnotte, demander de l'aide ou offrir un produit utile comme sur une marketplace, mais en mode solidaire.",
    preprod: "Pre-prod guidee",
    ctas: [
      { label: "Faire un don", href: "#faire-un-don" },
      { label: "Lancer une cagnotte", href: "#lancer-une-cagnotte" },
      { label: "Demander de l'aide", href: "#demander-aide" },
    ],
    explainerTitle: "Une logique simple et propre",
    explainerBody:
      "Dans CARES, on ne publie pas un don comme une annonce floue. On soutient une cause, on lance une cagnotte, on depose une demande d'aide ou on propose un produit a offrir avec un vrai suivi.",
    chips: ["Dons verifies", "Produits a offrir", "Cagnottes", "Demandes d'aide", "Impact"],
    metrics: [
      { value: "4", label: "Actions utiles", detail: "Donner, offrir un produit, lancer une cagnotte, demander de l'aide" },
      { value: "0", label: "Prix sur un don produit", detail: "Comme une fiche marketplace, mais le produit est offert" },
      { value: "5", label: "Etapes de suivi", detail: "De la soumission jusqu'au recap d'impact" },
    ],
    heroHighlights: [
      "Offrir un vetement ou un objet = fiche type marketplace, avec prix a zero et statut solidaire.",
      "Chaque don, campagne ou demande a ses statuts, ses preuves et ses recaps.",
      "Le cahier des charges et la logique produit restent accessibles dans un vrai panneau 'A propos'.",
    ],
    aboutButtonLabel: "A propos de CARES",
    aboutButtonHint: "Voir le cahier des charges, les statuts et les infos produit sans alourdir la page.",
    useCasesTitle: "Ce que l'on pourra faire dans CARES",
    useCasesSubtitle:
      "On met d'abord en avant les usages concrets. L'utilisateur doit comprendre en quelques secondes s'il vient pour donner, offrir, mobiliser ou demander du soutien.",
    useCases: [
      {
        title: "Don financier",
        subtitle: "Soutenir vite une cause",
        description:
          "Je choisis une cause ou une campagne verifiee, je paie en quelques secondes, puis je recois un recap et je suis l'affectation de mon don.",
        chips: ["Paiement", "Recu", "Affectation", "Impact"],
      },
      {
        title: "Produit a offrir",
        subtitle: "Comme une marketplace, mais solidaire",
        description:
          "Je publie un vetement, un sac de riz ou un objet utile comme une fiche produit classique: titre, photo, categorie, etat, lieu. La difference: le prix est a zero et le produit est destine a etre offert.",
        chips: ["Photo", "Categorie", "Etat", "Lieu", "Prix 0"],
      },
      {
        title: "Demande d'aide",
        subtitle: "Ouvrir un besoin suivi",
        description:
          "Je depose une demande d'aide locale ou urgente, elle est verifiee, qualifiee, puis reliee aux bons soutiens, campagnes ou dons produits.",
        chips: ["Urgence", "Verification", "Matching", "Resolution"],
      },
    ],
    productTitle: "Les 3 parcours principaux a rendre ultra-clairs",
    productSubtitle:
      "Chaque bouton principal correspond a un vrai usage. On veut une page legere: trois portes d'entree fortes, puis des panneaux qui expliquent le detail sans noyer l'utilisateur.",
    journeys: [
      {
        id: "faire-un-don",
        label: "Faire un don",
        eyebrow: "Cote donateur",
        description:
          "Choisir une cause verifiee, contribuer en argent ou soutenir une campagne, puis suivre l'usage du don jusqu'a l'impact.",
        bullets: [
          "Selection d'une cause ou d'une cagnotte verifiee",
          "Paiement simple et recu immediat",
          "Suivi de l'affectation et des preuves d'usage",
        ],
        cta: "Voir le parcours",
        panelTitle: "Parcours donateur",
        panelDescription:
          "Un don n'est pas un contenu publie librement. C'est une contribution a une cause verifiee, avec un recu, un suivi et une preuve d'impact.",
        previewFields: [
          { label: "Action", value: "Choisir une cause, un projet ou une demande verifiee" },
          { label: "Paiement", value: "Montant, methode de paiement, recu immediat" },
          { label: "Suivi", value: "Affectation, usage, recap d'impact et updates" },
        ],
        statusPath: ["Initie", "Confirme", "Affecte", "Utilise", "Impact publie"],
        opsBullets: [
          "Verification des causes et organisateurs avant visibilite",
          "Journal des transactions et preuves d'utilisation",
          "Notification donateur a chaque jalon important",
        ],
        footerNote:
          "Le donateur ne publie pas une annonce. Il declenche une contribution suivie de bout en bout, avec transparence et preuves.",
        panelPrimary: "Recevoir l'ouverture des dons",
      },
      {
        id: "lancer-une-cagnotte",
        label: "Lancer une cagnotte",
        eyebrow: "Cote porteur de projet",
        description:
          "Creer une campagne claire, definie par un objectif, un contexte, des justificatifs et un plan de mise a jour pour inspirer confiance.",
        bullets: [
          "Objectif, montant cible et contexte du projet",
          "Pieces justificatives et moderation avant mise en ligne",
          "Suivi des dons, jalons et publication d'impact",
        ],
        cta: "Preparer ma campagne",
        panelTitle: "Parcours createur de cagnotte",
        panelDescription:
          "Une cagnotte cree un objet produit a part entiere: objectif, justificatifs, updates, equipe, moderation et historique de dons.",
        previewFields: [
          { label: "Objet cree", value: "Campagne avec objectif, montant cible et contexte" },
          { label: "Confiance", value: "Pieces, verification, moderation et controle de visibilite" },
          { label: "Pilotage", value: "Dons recus, updates, jalons et publication d'impact" },
        ],
        statusPath: ["Brouillon", "En revue", "Active", "En verification", "Cloturee"],
        opsBullets: [
          "Moderation avant publication et apres signalement",
          "Tableau de bord campagne avec progression et dons recus",
          "Publication d'impact obligatoire pour renforcer la confiance",
        ],
        footerNote:
          "Le createur ne depose pas juste un texte. Il ouvre une campagne structuree, moderee, suivie et mesurable.",
        panelPrimary: "Structurer ma future campagne",
      },
      {
        id: "demander-aide",
        label: "Demander de l'aide",
        eyebrow: "Cote beneficiaire",
        description:
          "Deposer une demande d'aide locale ou urgente, etre relie a des soutiens, a des volontaires ou a des dons produits, puis suivre la resolution.",
        bullets: [
          "Description du besoin et niveau d'urgence",
          "Verification et mise en relation avec soutiens ou volontaires",
          "Suivi de la demande jusqu'a sa resolution",
        ],
        cta: "Comprendre le parcours",
        panelTitle: "Parcours demande d'aide",
        panelDescription:
          "Une demande d'aide ouvre un suivi clair: verification, qualification, matching, aides recues, resolution et recap.",
        previewFields: [
          { label: "Besoin", value: "Nature de l'aide, urgence, zone et justificatifs" },
          { label: "Matching", value: "Soutiens, volontaires, campagnes ou dons produits adaptes" },
          { label: "Resolution", value: "Aides recues, coordination et cloture du besoin" },
        ],
        statusPath: ["Soumise", "Verifiee", "Visible", "En cours de soutien", "Resolue"],
        opsBullets: [
          "Qualification du besoin avant diffusion",
          "Priorisation des demandes sensibles ou urgentes",
          "Journal d'aide recue, preuves et recap de resolution",
        ],
        footerNote:
          "Le beneficiaire ne publie pas un simple post. Il ouvre un dossier d'aide suivi, qualifie et oriente vers les bons soutiens.",
        panelPrimary: "Preparer ma demande d'aide",
      },
    ],
    modelsTitle: "Ce que CARES manipule vraiment",
    modelsSubtitle:
      "On commence a poser la vraie structure produit: des dons, des produits a offrir, des cagnottes et des demandes d'aide. Chaque objet a sa propre logique de moderation, de matching et de suivi.",
    models: [
      {
        title: "Don solidaire",
        subtitle: "Objet transactionnel",
        description:
          "Le don est rattache a une cause, une campagne ou une demande verifiee. Il produit un recu, un statut, puis un recap d'usage.",
        chips: ["Donateur", "Cause cible", "Recu", "Affectation"],
        states: ["Initie", "Confirme", "Affecte", "Utilise"],
      },
      {
        title: "Produit a offrir",
        subtitle: "Objet marketplace solidaire",
        description:
          "Un produit a offrir ressemble a une fiche marketplace classique: titre, photo, categorie, etat, lieu et disponibilite. La difference: il est publie pour etre donne, pas vendu.",
        chips: ["Photo", "Etat", "Lieu", "Prix 0", "Reservation"],
        states: ["Brouillon", "Visible", "Reserve", "Remis"],
      },
      {
        title: "Cagnotte ou demande d'aide",
        subtitle: "Objet mobilisation / besoin",
        description:
          "La cagnotte porte un objectif et la demande d'aide porte un besoin. Les deux servent a mobiliser la bonne aide avec un suivi clair.",
        chips: ["Objectif", "Urgence", "Verification", "Resolution"],
        states: ["Soumise", "En revue", "Active", "Cloturee"],
      },
    ],
    statusesTitle: "Les statuts que l'utilisateur doit pouvoir suivre",
    statusesSubtitle:
      "Le vrai plus produit, c'est la clarte. Chaque action doit avoir un cycle lisible, rassurant et explicite.",
    statusColumns: [
      {
        title: "Statut d'un don",
        tone: "emerald",
        items: ["Initie", "Confirme", "Affecte", "Utilise", "Impact publie"],
      },
      {
        title: "Statut d'un produit a offrir",
        tone: "cyan",
        items: ["Publie", "Visible", "Reserve", "Remis", "Cloture"],
      },
      {
        title: "Statut d'une demande d'aide",
        tone: "amber",
        items: ["Soumise", "Verifiee", "Visible", "En cours de soutien", "Resolue"],
      },
    ],
    whyTitle: "Pourquoi cette structure est forte",
    whyCards: [
      {
        title: "Confiance immediate",
        description: "L'utilisateur comprend ce qu'il peut faire, ce qui sera verifie, et comment le parcours sera suivi.",
      },
      {
        title: "Conversion plus simple",
        description: "Au lieu d'une page floue, on montre des usages concrets: donner, offrir un produit, lancer une cagnotte ou demander de l'aide.",
      },
      {
        title: "Impact lisible",
        description: "Les preuves, les recaps et les statuts rendent l'impact visible et renforcent la confiance dans la plateforme.",
      },
    ],
    trustTitle: "Confiance, operations et IA",
    trustCards: [
      {
        title: "Paiements & securite",
        items: ["PayDunya", "Fonds securises", "Validation conditionnelle", "Conformite et anti-fraude"],
      },
      {
        title: "Back-office & moderation",
        items: [
          "Validation des comptes et organisateurs",
          "Moderation des campagnes, produits a offrir et demandes",
          "Suivi des transactions et justificatifs",
          "Stats d'usage et d'impact",
        ],
      },
      {
        title: "IA utile",
        items: [
          "Matching donateur / cause / besoin",
          "Detection d'anomalies",
          "Aide a la redaction",
          "Priorisation des demandes sensibles",
        ],
      },
    ],
    specKicker: "Vision produit",
    specTitle: "Le cahier des charges reste la bonne base.",
    specBody:
      "On s'appuie dessus pour construire une verticale simple cote front aujourd'hui, puis un vrai produit demain: moderation, paiement, produits a offrir, suivi d'impact et matching intelligent.",
    specCaption:
      "Le panneau 'A propos de CARES' regroupe le cahier des charges, la structure produit, les statuts et la logique trust sans charger la page principale.",
    nextTitle: "Direction produit",
    nextBody:
      "La bonne logique pour CARES: une verticale claire avec des dons, des produits a offrir, des cagnottes et des demandes d'aide, chacun avec son cycle de vie et son suivi.",
    nextCta: "Explorer les autres univers",
    panelKicker: "Experience pre-prod",
    panelClose: "Fermer",
    panelPreviewTitle: "Structure du parcours",
    panelStatusTitle: "Statuts a suivre",
    panelOpsTitle: "Ops & confiance",
    panelFootnoteTitle: "Pourquoi ce flux compte",
    aboutPanelTitle: "A propos de CARES",
    aboutPanelBody:
      "Ici on garde toute la matiere produit et le cahier des charges, sans forcer l'utilisateur a tout lire avant de comprendre ce qu'il peut faire.",
  },
  en: {
    back: "Back to stores",
    kicker: "JONTAADO CARES",
    title: "Donate, offer useful items or request help in a simple and trust-first experience.",
    subtitle:
      "CARES should feel like a clear vertical: I can donate, launch a campaign, request help or offer an item the same way a marketplace product is listed, but as a solidarity gift.",
    preprod: "Guided pre-prod",
    ctas: [
      { label: "Donate", href: "#faire-un-don" },
      { label: "Launch a campaign", href: "#lancer-une-cagnotte" },
      { label: "Request help", href: "#demander-aide" },
    ],
    explainerTitle: "A simple, clean logic",
    explainerBody:
      "Inside CARES, users do not publish a vague donation post. They support a cause, launch a campaign, submit a help request or offer an item with a real follow-up.",
    chips: ["Verified donations", "Items to offer", "Campaigns", "Help requests", "Impact"],
    metrics: [
      { value: "4", label: "Useful actions", detail: "Donate, offer an item, launch a campaign, request help" },
      { value: "0", label: "Price on a gifted item", detail: "Like a marketplace listing, but the product is offered" },
      { value: "5", label: "Tracking stages", detail: "From submission to impact recap" },
    ],
    heroHighlights: [
      "Offering clothes or useful goods works like a marketplace listing, but with a zero price and a solidarity destination.",
      "Every donation, campaign or help request has statuses, proof and recap steps.",
      "The product brief stays available in a real 'About CARES' panel instead of crowding the page.",
    ],
    aboutButtonLabel: "About CARES",
    aboutButtonHint: "Open the brief, statuses and product logic without making the page heavy.",
    useCasesTitle: "What users should be able to do in CARES",
    useCasesSubtitle:
      "We lead with concrete use cases. Users should understand in seconds whether they came to donate, offer something useful, mobilize support or request help.",
    useCases: [
      {
        title: "Financial donation",
        subtitle: "Support a cause quickly",
        description:
          "Choose a verified cause or campaign, pay in seconds, then receive a recap and follow how the donation is allocated.",
        chips: ["Payment", "Receipt", "Allocation", "Impact"],
      },
      {
        title: "Item to offer",
        subtitle: "Like a marketplace, but solidarity-first",
        description:
          "Publish clothes, food or useful objects the same way you would publish a marketplace product: title, photo, category, condition and location. The difference: price is zero and the item is meant to be given away.",
        chips: ["Photo", "Category", "Condition", "Location", "Price 0"],
      },
      {
        title: "Help request",
        subtitle: "Open a tracked need",
        description:
          "Submit a local or urgent help request, get it verified and qualified, then match it with the right supporters, campaigns or gifted items.",
        chips: ["Urgency", "Verification", "Matching", "Resolution"],
      },
    ],
    productTitle: "The 3 main journeys that should feel obvious",
    productSubtitle:
      "Each main button maps to a real usage. The page should stay light: three strong entry points, then panels for details when people want to dig deeper.",
    journeys: [
      {
        id: "faire-un-don",
        label: "Donate",
        eyebrow: "Donor side",
        description:
          "Choose a verified cause, contribute money or support a campaign, then follow allocation and impact.",
        bullets: [
          "Pick a verified cause or campaign",
          "Simple payment with instant receipt",
          "Track allocation and proof of usage",
        ],
        cta: "View the flow",
        panelTitle: "Donor journey",
        panelDescription:
          "A donation is not a free-form published post. It is a contribution to a verified cause with a receipt, tracking and proof of impact.",
        previewFields: [
          { label: "Action", value: "Choose a verified cause, project or request" },
          { label: "Payment", value: "Amount, payment method and instant receipt" },
          { label: "Tracking", value: "Allocation, usage, impact recap and updates" },
        ],
        statusPath: ["Initiated", "Confirmed", "Allocated", "Used", "Impact published"],
        opsBullets: [
          "Cause and organizer verification before visibility",
          "Transaction log and proof of usage",
          "Donor notification at every key milestone",
        ],
        footerNote:
          "Donors do not publish a listing. They trigger a fully tracked contribution with transparency from start to finish.",
        panelPrimary: "Get notified when donations open",
      },
      {
        id: "lancer-une-cagnotte",
        label: "Launch a campaign",
        eyebrow: "Project owner side",
        description:
          "Create a clear campaign with a goal, context, proof and an update plan that inspires trust from day one.",
        bullets: [
          "Goal, target amount and project context",
          "Supporting proof and moderation before publishing",
          "Track donations, milestones and impact updates",
        ],
        cta: "Prepare my campaign",
        panelTitle: "Campaign creator journey",
        panelDescription:
          "A campaign becomes its own product object: goal, proof, updates, team, moderation and donation history.",
        previewFields: [
          { label: "Object created", value: "Campaign with goal, target amount and context" },
          { label: "Trust", value: "Proof, verification, moderation and visibility control" },
          { label: "Control", value: "Received donations, updates, milestones and impact publishing" },
        ],
        statusPath: ["Draft", "In review", "Live", "Under verification", "Closed"],
        opsBullets: [
          "Moderation before publishing and after reports",
          "Campaign dashboard with progress and incoming donations",
          "Impact publication required to strengthen trust",
        ],
        footerNote:
          "Campaign creators do not just post text. They open a structured, moderated and measurable funding journey.",
        panelPrimary: "Shape my future campaign",
      },
      {
        id: "demander-aide",
        label: "Request help",
        eyebrow: "Beneficiary side",
        description:
          "Submit a local or urgent help request, get matched with supporters, volunteers or gifted items, then follow the resolution clearly.",
        bullets: [
          "Describe the need and urgency level",
          "Verification and matching with supporters or volunteers",
          "Track the request until resolution",
        ],
        cta: "Understand the flow",
        panelTitle: "Help request journey",
        panelDescription:
          "A help request opens a clear follow-up: verification, qualification, matching, received support, resolution and recap.",
        previewFields: [
          { label: "Need", value: "Help type, urgency, area and supporting proof" },
          { label: "Matching", value: "Supporters, volunteers, campaigns or gifted items" },
          { label: "Resolution", value: "Support received, coordination and closure" },
        ],
        statusPath: ["Submitted", "Verified", "Visible", "Support in progress", "Resolved"],
        opsBullets: [
          "Need qualification before distribution",
          "Prioritization of sensitive or urgent requests",
          "Received support log, proof and resolution recap",
        ],
        footerNote:
          "Beneficiaries do not publish a simple post. They open a qualified support case routed to the right helpers.",
        panelPrimary: "Prepare my help request",
      },
    ],
    modelsTitle: "What CARES really manages",
    modelsSubtitle:
      "We are defining the real product structure: donations, gifted items, campaigns and help requests. Each object has its own moderation, matching and tracking logic.",
    models: [
      {
        title: "Solidarity donation",
        subtitle: "Transactional object",
        description:
          "The donation is attached to a verified cause, campaign or help request. It creates a receipt, a status and later a usage recap.",
        chips: ["Donor", "Target cause", "Receipt", "Allocation"],
        states: ["Initiated", "Confirmed", "Allocated", "Used"],
      },
      {
        title: "Gifted item",
        subtitle: "Solidarity marketplace object",
        description:
          "A gifted item looks like a classic marketplace listing: title, photo, category, condition, location and availability. The difference is that it is published to be given away, not sold.",
        chips: ["Photo", "Condition", "Location", "Price 0", "Reservation"],
        states: ["Draft", "Visible", "Reserved", "Delivered"],
      },
      {
        title: "Campaign or help request",
        subtitle: "Mobilization / need object",
        description:
          "Campaigns carry goals and help requests carry needs. Both exist to mobilize the right support with a readable follow-up.",
        chips: ["Goal", "Urgency", "Verification", "Resolution"],
        states: ["Submitted", "In review", "Live", "Closed"],
      },
    ],
    statusesTitle: "Statuses users should be able to follow",
    statusesSubtitle:
      "Real product value comes from clarity. Every action needs a readable, reassuring lifecycle.",
    statusColumns: [
      {
        title: "Donation status",
        tone: "emerald",
        items: ["Initiated", "Confirmed", "Allocated", "Used", "Impact published"],
      },
      {
        title: "Gifted item status",
        tone: "cyan",
        items: ["Published", "Visible", "Reserved", "Delivered", "Closed"],
      },
      {
        title: "Help request status",
        tone: "amber",
        items: ["Submitted", "Verified", "Visible", "Support in progress", "Resolved"],
      },
    ],
    whyTitle: "Why this structure works",
    whyCards: [
      {
        title: "Instant trust",
        description: "Users understand what they can do, what will be verified, and how the journey will be tracked.",
      },
      {
        title: "Simpler conversion",
        description: "Instead of a vague page, we show concrete actions: donate, offer an item, launch a campaign or request help.",
      },
      {
        title: "Readable impact",
        description: "Proof, recaps and statuses make impact visible and strengthen trust in the platform.",
      },
    ],
    trustTitle: "Trust, operations and AI",
    trustCards: [
      {
        title: "Payments & security",
        items: ["PayDunya", "Secured funds", "Conditional validation", "Compliance and anti-fraud"],
      },
      {
        title: "Back office & moderation",
        items: [
          "Account and organizer validation",
          "Campaign, gifted item and help request moderation",
          "Transaction and proof tracking",
          "Usage and impact analytics",
        ],
      },
      {
        title: "Useful AI",
        items: [
          "Donor / cause / need matching",
          "Anomaly detection",
          "Writing assistance",
          "Sensitive request prioritization",
        ],
      },
    ],
    specKicker: "Product vision",
    specTitle: "The product brief remains the right foundation.",
    specBody:
      "We use it to build a simple front-end vertical now, then a real product later: moderation, payments, gifted items, impact tracking and smart matching.",
    specCaption:
      "The 'About CARES' panel groups the brief, product structure, statuses and trust logic without making the main page heavy.",
    nextTitle: "Product direction",
    nextBody:
      "The right logic for CARES: a clear vertical with donations, gifted items, campaigns and help requests, each with its own lifecycle and tracking.",
    nextCta: "Explore other universes",
    panelKicker: "Pre-prod experience",
    panelClose: "Close",
    panelPreviewTitle: "Journey structure",
    panelStatusTitle: "Statuses to follow",
    panelOpsTitle: "Ops & trust",
    panelFootnoteTitle: "Why this flow matters",
    aboutPanelTitle: "About CARES",
    aboutPanelBody:
      "This is where we keep the product material and the brief, without forcing users to read everything before understanding what they can do.",
  },
};

export default async function JontaadoCaresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const page = content[isFr ? "fr" : "en"];

  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <AppHeader locale={locale} />

      <CaresProductExperience page={page} />

      <Footer />
    </div>
  );
}

