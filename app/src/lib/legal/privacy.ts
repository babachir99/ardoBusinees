import type { LegalDocument } from "@/lib/legal/types";

export const privacyDocument: LegalDocument = {
  slug: "privacy",
  title: "Politique de confidentialite et protection des donnees",
  subtitle:
    "Base de travail alignee prioritairement sur la loi senegalaise n 2008-12 et structuree selon les grands principes RGPD pour les activites de JONTAADO.",
  intro: [
    "La presente politique decrit les traitements de donnees personnelles realises dans le cadre de l'utilisation de JONTAADO. Elle doit etre completee avant mise en production avec l'identite exacte de l'entite editrice etablie au Senegal, ses coordonnees completes, les contacts conformite, les sous-traitants reellement utilises et les durees de conservation definitivement arbitrees.",
  ],
  sections: [
    {
      title: "1. Responsable du traitement",
      paragraphs: [
        "Le responsable du traitement est l'entite editrice de JONTAADO, a completer avec sa denomination sociale, son siege, son email de contact, son numero d'immatriculation et, le cas echeant, les coordonnees de son delegue a la protection des donnees.",
      ],
      note:
        "A completer avant publication : raison sociale, adresse au Senegal, email privacy, NINEA, RCCM si applicable et point de contact donnees personnelles.",
    },
    {
      title: "2. Personnes concernees",
      bullets: [
        "Visiteurs et utilisateurs de la marketplace",
        "Acheteurs, vendeurs, prestataires, transporteurs et annonceurs",
        "Prospects et demandeurs de publicite",
        "Personnes contactant le support ou faisant l'objet d'un signalement",
        "Representants legaux ou personnes verifiees dans le cadre du KYC",
      ],
    },
    {
      title: "3. Donnees susceptibles d'etre collectees",
      bullets: [
        "Donnees d'identification : nom, prenom, pseudo, email, telephone, photo, identifiants de compte.",
        "Donnees de profil et de role : type de compte, langue, preferences, statut vendeur/prestataire/transporteur, informations KYC.",
        "Donnees transactionnelles : commandes, paiements, livraisons, remboursements, offres, paniers, favoris, reservations.",
        "Donnees de contenu : annonces, images, avis, messages, demandes de support, signalements, pieces jointes.",
        "Donnees techniques : logs, appareil, navigateur, adresses IP, journaux de securite, cookies et traceurs.",
        "Donnees de conformite : justificatifs d'identite, documents professionnels, informations anti-fraude ou de verification.",
      ],
    },
    {
      title: "4. Finalites et bases legales",
      bullets: [
        "Creation et gestion du compte : execution du contrat ou mesures precontractuelles.",
        "Mise en relation, publication d'annonces, gestion des commandes, paiements, livraisons et support : execution du contrat.",
        "Securite, prevention de la fraude, moderation, lutte contre les abus, conservation de preuves : interet legitime et, selon les cas, obligations legales.",
        "Respect des obligations comptables, fiscales, de conformite, KYC et reponses aux autorites : obligation legale.",
        "Envoi de communications operationnelles : execution du service et interet legitime.",
        "Mesure d'audience, personnalisation ou publicite : consentement lorsqu'il est requis.",
      ],
      note:
        "Si JONTAADO cible egalement des utilisateurs situes dans l'Union europeenne, certaines operations pourront devoir etre appreciees aussi a la lumiere du RGPD en plus du cadre senegalais.",
    },
    {
      title: "5. Caractere obligatoire ou facultatif des donnees",
      paragraphs: [
        "Certaines donnees sont necessaires pour creer un compte, traiter une commande, publier une offre, repondre a une demande, verifier un profil ou assurer la securite de la plateforme. Lorsque ces donnees ne sont pas fournies, tout ou partie du service concerne peut etre indisponible.",
      ],
    },
    {
      title: "6. Destinataires des donnees",
      bullets: [
        "Equipes internes habilitees de JONTAADO selon le besoin d'en connaitre.",
        "Autres utilisateurs lorsqu'une donnee doit etre affichee pour permettre la mise en relation ou l'execution d'une transaction.",
        "Prestataires techniques, hebergeurs, processeurs de paiement, outils de support, emailing, analytics, securite, moderation ou KYC agissant en qualite de sous-traitants ou de responsables distincts selon les cas.",
        "Autorites, juridictions, administrations ou organismes habilites lorsque la loi l'exige.",
      ],
    },
    {
      title: "7. Sous-traitants et encadrement contractuel",
      paragraphs: [
        "Lorsque JONTAADO a recours a des sous-traitants, ceux-ci sont selectionnes pour leurs garanties suffisantes en matiere de securite, de confidentialite et de conformite RGPD. Les traitements confies sont encadres par un contrat conforme a l'article 28 du RGPD.",
      ],
    },
    {
      title: "8. Transferts hors Union europeenne",
      paragraphs: [
        "Si certains prestataires ou infrastructures impliquent un transfert de donnees hors de l'Union europeenne, JONTAADO doit mettre en place un mecanisme de transfert approprie et informer les personnes concernees des garanties utilisees.",
      ],
      note:
        "A completer avec la liste reelle des transferts et garanties associees avant mise en production.",
    },
    {
      title: "9. Durees de conservation",
      bullets: [
        "Compte actif : pendant la relation contractuelle puis archivage intermediaire lorsque necessaire.",
        "Commandes, paiements, facturation et obligations comptables : selon les durees legales applicables.",
        "Messagerie, signalements, litiges et securite : pendant la duree necessaire au traitement, a la preuve et a la defense des droits.",
        "Prospection et publicite : selon le cycle de vie de la relation et les choix de consentement.",
        "Cookies et traceurs : selon leur finalite, les regles CNIL et les choix de l'utilisateur.",
      ],
      note:
        "Une matrice de conservation plus precise doit etre finalisee en annexe interne avant mise en production.",
    },
    {
      title: "10. Droits des personnes",
      bullets: [
        "Droit d'acces, de rectification et d'effacement",
        "Droit a la limitation du traitement",
        "Droit d'opposition lorsque le traitement repose sur l'interet legitime",
        "Droit a la portabilite lorsque les conditions sont remplies",
        "Droit de retirer son consentement a tout moment pour les traitements fondes sur le consentement",
        "Droit d'introduire une reclamation aupres de la Commission de Protection des Donnees Personnelles du Senegal ou de toute autorite competente",
      ],
      paragraphs: [
        "Les demandes peuvent etre adressees au point de contact privacy de JONTAADO. Une preuve d'identite raisonnable peut etre demandee lorsque cela est necessaire pour eviter toute divulgation non autorisee.",
      ],
    },
    {
      title: "11. Securite",
      paragraphs: [
        "JONTAADO met en oeuvre des mesures techniques et organisationnelles adaptees au risque, notamment en matiere d'authentification, de journalisation, de controle d'acces, de cloisonnement, de sauvegarde, de limitation des acces, de protection contre la fraude et de gestion des incidents.",
      ],
    },
    {
      title: "12. Mineurs",
      paragraphs: [
        "Les services ne doivent pas etre utilises en violation des regles applicables a la capacite juridique. Lorsqu'une verticale expose des risques particuliers ou implique des transactions reglementees, des verifications complementaires peuvent etre requises.",
      ],
    },
    {
      title: "13. Cookies et traceurs",
      paragraphs: [
        "La politique cookies decrit les categories de traceurs utilisees, les finalites poursuivies, les bases legales, les modalites de consentement et la maniere de retirer ses choix.",
      ],
    },
    {
      title: "14. Traitements sensibles et verticale Cares",
      paragraphs: [
        "JONTAADO doit eviter autant que possible de collecter des donnees sensibles, en particulier des donnees de sante. Si certaines fonctionnalites de la verticale Cares conduisent a de tels traitements, une base juridique specifique, une minimisation renforcee, des garanties de securite accrues et une documentation dediee sont indispensables.",
      ],
    },
    {
      title: "15. Revision et mise a jour",
      note:
        "Cette politique doit etre relue par un conseil juridique et alignee avec la cartographie reelle des traitements, des sous-traitants, des durees de conservation, des transferts et des fonctionnalites effectivement mises en production, avec validation du cadrage Senegal en priorite.",
    },
  ],
};

