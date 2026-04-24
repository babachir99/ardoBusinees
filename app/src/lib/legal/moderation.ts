import type { LegalDocument } from "@/lib/legal/types";

export const moderationDocument: LegalDocument = {
  slug: "moderation",
  title: "Politique de moderation, avis et signalements",
  subtitle:
    "Regles de traitement des avis, contenus, signalements, litiges et mesures de surete sur JONTAADO.",
  sections: [
    {
      title: "1. Objet",
      paragraphs: [
        "La presente politique precise la maniere dont JONTAADO recueille, modere et traite les avis, signalements, plaintes, blocages, demandes de retrait et autres alertes relatives aux comptes, contenus, annonces et interactions entre utilisateurs.",
      ],
    },
    {
      title: "2. Avis en ligne",
      bullets: [
        "Les avis doivent etre loyaux et porter sur une experience reelle.",
        "JONTAADO peut limiter la publication des avis aux achats ou experiences verifies.",
        "La date de publication de l'avis et, le cas echeant, celle de sa mise a jour doivent etre affichees.",
        "Les avis peuvent faire l'objet d'un controle manuel, automatise ou mixte destine a detecter la fraude, la manipulation, l'incoherence ou les violations des regles.",
      ],
    },
    {
      title: "3. Motifs possibles de refus ou retrait d'un avis",
      bullets: [
        "Avis sans lien avec une experience reelle",
        "Usurpation, manipulation, conflit d'interets ou achat d'avis",
        "Propos illicites, injurieux, diffamatoires, discriminatoires ou menacants",
        "Divulgation de donnees personnelles, de secrets ou d'informations confidentielles",
        "Spam, publicite dissimulee ou contenu hors sujet",
      ],
    },
    {
      title: "4. Signalements",
      paragraphs: [
        "Tout utilisateur peut signaler un compte, un contenu, un message, une annonce, une publicite, un avis ou un comportement suspect via les outils proposes sur la plateforme.",
      ],
      bullets: [
        "Le signalement doit etre aussi circonstancie que possible.",
        "Des pieces justificatives peuvent etre demandees ou transmises.",
        "Les signalements manifestement abusifs, malveillants ou repetes peuvent eux-memes entrainer des mesures de moderation.",
      ],
    },
    {
      title: "5. Mesures possibles",
      bullets: [
        "Masquage temporaire d'un contenu",
        "Demande de justificatifs ou de correction",
        "Refus de publication ou retrait definitif",
        "Limitation de certaines fonctionnalites",
        "Blocage entre utilisateurs",
        "Suspension ou fermeture d'un compte",
        "Transmission aux autorites competentes lorsque la loi l'exige",
      ],
    },
    {
      title: "6. Droit de reponse et contestation",
      paragraphs: [
        "Sous reserve des exigences de securite, de confidentialite et d'enquete, la personne concernee peut etre informee de la mesure prise et demander un reexamen raisonnable de la decision aupres du support ou du canal de recours interne indique par JONTAADO.",
      ],
    },
    {
      title: "7. Conservation des preuves",
      paragraphs: [
        "Les contenus retires, journaux techniques, echanges, signalements et justificatifs peuvent etre conserves pendant la duree necessaire a l'examen de l'alerte, a la defense des droits, a la gestion d'un litige ou au respect d'une obligation legale.",
      ],
    },
    {
      title: "8. References reglementaires",
      note:
        "Cette politique doit etre relue a la lumiere des obligations applicables aux avis en ligne, au droit de la consommation, au RGPD, au DSA et aux regles internes de moderation reellement mises en oeuvre.",
    },
  ],
};

