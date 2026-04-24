import type { LegalDocument } from "@/lib/legal/types";

export const verticalTermsDocument: LegalDocument = {
  slug: "verticals",
  title: "Annexes verticales JONTAADO",
  subtitle:
    "Regles complementaires applicables selon l'univers utilise. Elles completent les CGU Marketplace et doivent etre lues avec elles.",
  intro: [
    "Chaque verticale repond a des contraintes metier specifiques. Les utilisateurs s'engagent a respecter, en plus des CGU Marketplace, les regles suivantes lorsqu'ils publient, achetent, reservent, transportent ou promeuvent des contenus dans l'univers concerne.",
  ],
  sections: [
    {
      title: "1. Regles communes a toutes les verticales",
      bullets: [
        "Fournir des informations exactes, a jour et non trompeuses.",
        "Detenir les autorisations, titres, mandats, habilitations ou assurances exiges par la loi pour l'activite proposee.",
        "Ne publier que des offres reellement disponibles et licites.",
        "Repondre aux demandes raisonnables de preuve ou de conformite de JONTAADO.",
      ],
    },
    {
      title: "2. JONTAADO Cars",
      bullets: [
        "Les annonces automobiles doivent decrire fidelement l'etat du vehicule, son kilometrage, son annee, ses caracteristiques, ses documents disponibles et, le cas echeant, l'historique connu.",
        "Le vendeur garantit etre autorise a vendre ou promouvoir le vehicule et a publier les photos et elements associes.",
        "Sont interdits : faux kilometrages, vehicule vole, documents falsifies, annonces de complaisance, prix destines a attirer artificiellement, pieces ou vehicules interdits.",
      ],
      note:
        "Des justificatifs complementaires peuvent etre exiges avant publication, remise en avant ou finalisation de certaines operations.",
    },
    {
      title: "3. JONTAADO Immo",
      bullets: [
        "Les annonces immobilieres doivent preciser avec loyaute la nature du bien, sa localisation, sa surface, son statut, son prix, sa disponibilite, les conditions essentielles et, le cas echeant, le mandat ou la qualite d'intermediaire.",
        "Toute pratique discriminatoire, trompeuse ou contraire aux regles du logement est interdite.",
        "Les professionnels doivent veiller au respect des obligations d'information qui leur sont propres.",
      ],
    },
    {
      title: "4. JONTAADO Presta",
      bullets: [
        "Le prestataire decrit precisement la nature du service, son perimetre, son delai, son prix ou les modalites d'etablissement du prix, ainsi que ses conditions essentielles d'execution.",
        "Les services reglementes ne peuvent etre proposes qu'avec les autorisations et qualifications requises.",
        "Les prestations illicites, dissimulees, frauduleuses, dangereuses ou portant atteinte aux droits des tiers sont interdites.",
      ],
    },
    {
      title: "5. JONTAADO Tiak",
      bullets: [
        "Les utilisateurs s'engagent a ne pas proposer ou transporter de contenus interdits, dangereux, illicites ou non compatibles avec les regles de securite applicables.",
        "Les informations relatives au point de depart, de livraison, au colis, aux dimensions, au poids, au delai et au contact doivent etre exactes.",
        "Le livreur, transporteur ou expediteur doit respecter les procedures de remise, de preuve et de securite definies par la plateforme ou par la loi.",
      ],
    },
    {
      title: "6. JONTAADO GP",
      bullets: [
        "Les offres de transport, d'acheminement ou de capacite doivent correspondre a une realite operationnelle verifiable.",
        "L'expediteur et le transporteur declarent loyalement le trajet, la date, la capacite disponible, les restrictions, les objets refuses et les modalites de remise.",
        "JONTAADO n'assure pas la valeur intrinseque des biens transportes sauf engagement specifique publie a cet effet.",
      ],
    },
    {
      title: "7. JONTAADO Cares",
      paragraphs: [
        "Cette verticale appelle une vigilance renforcee. Elle ne doit pas etre utilisee pour des urgences medicales ou pour contourner la reglementation applicable aux professions de sante, du soin, du bien-etre ou de l'accompagnement de personnes vulnerables.",
      ],
      bullets: [
        "Aucune annonce ne doit promettre un diagnostic medical, un traitement medical ou une prise en charge reglementee sans y etre legalement autorisee.",
        "Les informations sensibles ou relatives a la sante doivent etre minimisees. Leur collecte doit etre evitee autant que possible tant que l'architecture conformite n'est pas arretee et auditee.",
        "Les professionnels doivent pouvoir justifier, sur demande, de leurs titres, assurances et autorisations.",
      ],
      note:
        "Si la verticale Cares implique reellement des donnees de sante, une annexe RGPD specifique et une revue juridique renforcee sont indispensables avant mise en production.",
    },
    {
      title: "8. Publicite et campagnes sponsorisees",
      bullets: [
        "Les campagnes sponsorisees doivent etre licites, loyales, clairement identifiables comme sponsorisees lorsqu'elles influencent la visibilite d'une offre, et compatibles avec la verticale concernee.",
        "JONTAADO peut refuser, ajourner ou retirer une campagne en cas de non-conformite editoriale, reglementaire, reputationnelle ou securitaire.",
      ],
    },
  ],
};

