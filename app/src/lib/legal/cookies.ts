import type { LegalDocument } from "@/lib/legal/types";

export const cookiesDocument: LegalDocument = {
  slug: "cookies",
  title: "Politique cookies et autres traceurs",
  subtitle:
    "Regles applicables au depot et a la lecture de cookies, SDK, pixels et autres traceurs sur JONTAADO.",
  intro: [
    "JONTAADO utilise des traceurs strictement necessaires au fonctionnement de la plateforme et, selon les choix de l'utilisateur, d'autres traceurs destines a la mesure d'audience, a la personnalisation, a la publicite ou a l'amelioration du service.",
  ],
  sections: [
    {
      title: "1. Qu'est-ce qu'un traceur ?",
      paragraphs: [
        "Un traceur est un fichier ou identifiant, tel qu'un cookie HTTP, un pixel, un SDK, un identifiant d'appareil ou un autre mecanisme de lecture/ecriture dans le terminal, utilise pour faire fonctionner un service, mesurer son audience, personnaliser l'experience ou diffuser des contenus publicitaires.",
      ],
    },
    {
      title: "2. Traceurs strictement necessaires",
      bullets: [
        "Authentification et securite de session",
        "Conservation du choix en matiere de cookies",
        "Panier, langue, preferences essentielles et stabilite du service",
        "Protection contre les abus et les tentatives d'acces automatisees",
      ],
      paragraphs: [
        "Ces traceurs peuvent etre deposes sans consentement prealable lorsqu'ils sont strictement necessaires au service demande par l'utilisateur.",
      ],
    },
    {
      title: "3. Traceurs soumis au consentement",
      bullets: [
        "Mesure d'audience non exemptee",
        "Personnalisation non essentielle",
        "Publicite ciblee, retargeting et campagnes sponsorisees",
        "Partage social ou enrichissements tiers non strictement necessaires",
      ],
      paragraphs: [
        "Ces traceurs ne sont actives qu'apres un consentement libre, specifique, eclaire et univoque de l'utilisateur, lorsque la reglementation l'exige.",
      ],
    },
    {
      title: "4. Gestion du consentement",
      bullets: [
        "L'utilisateur peut accepter, refuser ou parametrer les traceurs non essentiels avant leur activation.",
        "Le refus doit etre aussi simple que l'acceptation.",
        "Le retrait du consentement doit rester possible a tout moment depuis un outil accessible.",
        "Les choix peuvent etre conserves afin d'eviter de solliciter l'utilisateur a chaque visite dans les limites permises par la reglementation.",
      ],
    },
    {
      title: "5. Consentement multi-terminaux",
      paragraphs: [
        "Si JONTAADO met en place un recueil de consentement multi-terminaux dans des univers connectes, l'utilisateur doit pouvoir donner, refuser et retirer son consentement avec la meme simplicite sur l'ensemble des appareils lies au compte concerne.",
      ],
    },
    {
      title: "6. Duree de vie des traceurs",
      paragraphs: [
        "La duree de vie des cookies et autres traceurs doit etre proportionnee a leur finalite. Les durees effectives doivent etre documentees dans l'outil de gestion du consentement et dans l'inventaire interne des traceurs.",
      ],
    },
    {
      title: "7. Parametrage navigateur et plateforme",
      paragraphs: [
        "L'utilisateur peut egalement configurer son navigateur, son terminal ou les parametres du site pour limiter ou supprimer certains traceurs, sous reserve de l'impact eventuel sur le fonctionnement du service.",
      ],
    },
    {
      title: "8. Mise a jour",
      note:
        "Cette politique doit etre alignee avec l'outil CMP reellement utilise, les categories de traceurs effectivement deposes et les durees techniques parametrees en production.",
    },
  ],
};

