import type { LegalDocument } from "@/lib/legal/types";

export const marketplaceTermsDocument: LegalDocument = {
  slug: "terms",
  title: "Conditions generales d'utilisation de JONTAADO Marketplace",
  subtitle:
    "Document-cadre applicable a l'utilisation de la plateforme, a la mise en relation entre utilisateurs et aux differents univers JONTAADO, avec un ancrage principal en droit senegalais.",
  intro: [
    "Les presentes conditions generales d'utilisation encadrent l'acces et l'usage des services JONTAADO. Elles s'appliquent a tout visiteur, utilisateur inscrit, vendeur, prestataire, transporteur, annonceur ou acheteur utilisant la plateforme.",
    "Chaque verticale peut etre completee par une annexe metier. En cas de contradiction entre les presentes CGU et une annexe verticale, l'annexe s'applique pour les regles propres a l'univers concerne.",
  ],
  sections: [
    {
      title: "1. Objet de la plateforme",
      paragraphs: [
        "JONTAADO met a disposition une marketplace multi-verticales permettant notamment la publication d'annonces, la vente de biens, la recherche de services, l'organisation de livraisons, la mise en relation entre particuliers et professionnels, la gestion de campagnes sponsorisees et l'acces a des outils de messagerie, de paiement, de signalement et de moderation.",
        "Sauf mention contraire expresse sur une offre determinee, JONTAADO agit comme operateur de plateforme et intermediaire technique. JONTAADO n'est pas, par principe, le vendeur, le prestataire, le mandataire, le transporteur effectif ni l'assureur des transactions conclues entre utilisateurs.",
      ],
    },
    {
      title: "2. Acceptation et evolution des CGU",
      paragraphs: [
        "L'utilisation des services suppose l'acceptation pleine et entiere des presentes CGU ainsi que des politiques associees de confidentialite, cookies, moderation et, le cas echeant, des conditions contractuelles applicables a une transaction.",
        "JONTAADO peut faire evoluer les presentes CGU pour tenir compte d'evolutions techniques, legales, reglementaires, securitaires ou fonctionnelles. La version opposable est celle publiee sur la plateforme a la date d'utilisation du service.",
      ],
    },
    {
      title: "3. Acces aux services et creation de compte",
      bullets: [
        "Certaines fonctionnalites sont accessibles sans compte ; d'autres requierent un compte personnel ou professionnel.",
        "L'utilisateur s'engage a fournir des informations exactes, a jour et completes.",
        "Le compte est personnel ; les identifiants ne doivent pas etre cedes, pretes ou partages de maniere non autorisee.",
        "JONTAADO peut demander des justificatifs complementaires pour certaines fonctionnalites sensibles : vente, annonces reglementees, monetisation, publicite, transport, prestations professionnelles ou retrait de fonds.",
      ],
    },
    {
      title: "4. Roles et eligibilite",
      paragraphs: [
        "La plateforme peut distinguer plusieurs roles : visiteur, acheteur, vendeur, prestataire, transporteur, annonceur, administrateur ou professionnel soumis a verification. L'acces a certains services peut dependre d'une validation documentaire, d'un niveau de confiance ou d'une decision de moderation.",
      ],
    },
    {
      title: "5. Publication des contenus, annonces et offres",
      bullets: [
        "L'utilisateur publie sous sa seule responsabilite les informations, visuels, prix, caracteristiques, disponibilites, delais, documents et declarations qu'il met en ligne.",
        "Toute annonce doit etre loyale, claire, comprehensible, non trompeuse et suffisamment precise pour permettre une decision eclairee de l'autre partie.",
        "L'utilisateur garantit disposer de tous les droits necessaires sur les contenus publies et sur les biens ou services proposes.",
        "Les contenus illicites, contrefaisants, discriminatoires, haineux, frauduleux, trompeurs, diffamatoires, contraires a l'ordre public ou aux droits des tiers sont interdits.",
      ],
      note:
        "JONTAADO peut suspendre, masquer, dereferencer ou supprimer un contenu qui ne respecte pas les presentes regles, les annexes verticales ou la loi.",
    },
    {
      title: "6. Referencement, classement et mise en avant",
      bullets: [
        "Les resultats peuvent etre influences par la pertinence de la recherche, la categorie selectionnee, la disponibilite, l'exhaustivite des annonces, la qualite editoriale, l'anciennete, le niveau de confiance du compte, la localisation, la performance constatee et la conformite aux regles de la plateforme.",
        "Certaines mises en avant sponsorisees, campagnes publicitaires, boosts ou formats premium peuvent influer sur la visibilite d'un contenu.",
        "Lorsqu'une remuneration ou un avantage influence la visibilite, la plateforme doit le signaler de maniere intelligible.",
      ],
    },
    {
      title: "7. Transactions, paiements et frais",
      bullets: [
        "Selon la verticale, la plateforme peut proposer panier, commande, paiement, reservation, offre de prix, acompte, livraison, mise en relation ou publicite payante.",
        "Le prix affiche par un vendeur ou prestataire engage ce dernier sous reserve de disponibilite, d'erreur manifeste, de fraude ou de suspension.",
        "Les frais de service, livraison, commissions, taxes, remises, promotions ou couts complementaires doivent etre affiches ou rappeles avant validation finale lorsque la plateforme intervient dans le flux de commande.",
        "Le bouton de validation finale doit exprimer sans ambiguite l'obligation de payer.",
      ],
      note:
        "Pour les fournisseurs electroniques de biens ou services etablis au Senegal, les obligations d'information doivent notamment etre appreciees au regard de la loi n 2008-08 du 25 janvier 2008 sur les transactions electroniques.",
    },
    {
      title: "8. Obligations des vendeurs, prestataires et annonceurs",
      bullets: [
        "Respecter les lois applicables a leur activite, y compris en matiere de consommation, fiscalite, publicite, securite produit, licences, autorisations et obligations professionnelles.",
        "Publier des informations precontractuelles exactes, notamment sur l'identite, les caracteristiques essentielles, le prix, les delais et les restrictions eventuelles.",
        "Assumer l'execution effective de la vente, du service ou de la livraison lorsqu'ils en ont la charge.",
        "Repondre loyalement aux utilisateurs et cooperer en cas de controle, litige, signalement ou demande de justificatifs.",
      ],
      note:
        "Lorsque le vendeur ou prestataire est etabli au Senegal, les informations d'identification pertinentes doivent inclure, selon le cas, la raison sociale, l'adresse, le telephone, l'email, le NINEA, l'immatriculation et les references d'autorisation ou d'inscription professionnelle applicables.",
    },
    {
      title: "9. Messagerie, negociation et communications",
      paragraphs: [
        "La plateforme peut fournir une messagerie interne, des demandes d'offres, des modeles de messages, des outils de contact externe ou des formulaires de demande commerciale. Ces outils doivent etre utilises exclusivement pour des echanges licites en lien avec le service. Les usages abusifs, le demarchage non autorise, le harcelement, le spam, l'usurpation d'identite et la fraude sont interdits.",
      ],
    },
    {
      title: "10. Avis, notes, favoris et historiques",
      bullets: [
        "Les avis doivent reposer sur une experience reelle et ne pas etre manipules.",
        "La plateforme peut verifier, moderer, refuser, retirer ou signaler un avis suspect ou non authentique.",
        "Les modalites de collecte, de controle, de publication et de retrait des avis sont detaillees dans la politique de moderation et d'avis.",
      ],
    },
    {
      title: "11. Signalements, moderation et sanctions",
      bullets: [
        "Tout utilisateur peut signaler un contenu, un compte, un avis, un message ou un comportement suspect via les outils dedies.",
        "JONTAADO peut demander des preuves, geler certaines fonctionnalites, bloquer une interaction, suspendre un compte, dereferencer une annonce, annuler une diffusion sponsorisee ou transmettre certains elements aux autorites competentes lorsque la loi l'exige.",
        "Les mesures sont prises de maniere proportionnee selon la gravite des faits, les risques identifies, les obligations legales et les elements disponibles.",
      ],
    },
    {
      title: "12. Donnees personnelles et conformite",
      paragraphs: [
        "Les traitements de donnees personnelles realises dans le cadre de la plateforme sont decrits dans la politique de confidentialite et, le cas echeant, dans les documents complementaires publies dans le Trust Center. Chaque utilisateur s'engage a ne collecter, utiliser ou reutiliser des donnees personnelles obtenues via JONTAADO que dans un cadre licite, determine et strictement necessaire.",
      ],
    },
    {
      title: "13. Propriete intellectuelle",
      paragraphs: [
        "La plateforme, ses interfaces, bases de donnees, visuels, textes, logos, marques, elements graphiques, codes sources, structures et contenus editoriaux sont proteges par les droits de propriete intellectuelle applicables.",
        "Les utilisateurs concedent a JONTAADO, pour la duree necessaire a l'exploitation du service, une licence non exclusive permettant d'heberger, reproduire, adapter, mettre en forme, referencer et diffuser les contenus publies dans le seul but d'executer les services de la plateforme et de promouvoir les offres publiees sur ses supports.",
      ],
    },
    {
      title: "14. Responsabilite",
      bullets: [
        "JONTAADO met en oeuvre des moyens raisonnables pour assurer la disponibilite, la securite et le bon fonctionnement de la plateforme, sans garantir une disponibilite continue, l'absence d'erreur, ni l'absence totale de contenu frauduleux ou illicite.",
        "Sauf faute propre demontree, JONTAADO n'est pas responsable de l'execution d'un contrat conclu entre utilisateurs, de la qualite intrinseque d'un bien ou service, de la veracite totale des declarations publiees par les tiers ou d'un dommage indirect.",
        "L'utilisateur reste responsable des engagements contractuels qu'il prend envers les autres parties.",
      ],
    },
    {
      title: "15. Suspension, resiliation et fermeture de compte",
      bullets: [
        "L'utilisateur peut fermer son compte conformement aux fonctionnalites mises a disposition ou en contactant le support.",
        "JONTAADO peut suspendre ou resilier un compte, avec ou sans preavis selon l'urgence, en cas de violation des CGU, de risque de fraude, d'obligation reglementaire, de fausse identite, de refus de cooperer a un controle ou de danger pour les utilisateurs ou la plateforme.",
        "Certaines donnees peuvent etre conservees apres fermeture du compte lorsque la loi l'impose ou pour la defense des droits de la plateforme.",
      ],
    },
    {
      title: "16. Droit applicable et reglement des litiges",
      paragraphs: [
        "Les presentes CGU ont vocation a etre regies prioritairement par le droit senegalais lorsque l'entite editrice de JONTAADO est etablie au Senegal, sous reserve des dispositions imperatives de protection du consommateur ou des regles internationales applicables dans certains pays cibles.",
        "Les utilisateurs sont invites a rechercher d'abord une solution amiable via le support. Pour les consommateurs, la possibilite de recourir a un mediateur competent ou aux voies prevues par la reglementation doit etre precisee dans les informations legales et contractuelles publiees par l'entite concernee.",
      ],
    },
    {
      title: "17. Revision juridique necessaire",
      note:
        "Le present document constitue une base operationnelle de conformite et de redaction produit. Il doit etre valide et ajuste par un conseil juridique avant mise en production, notamment pour l'identification exacte de l'editeur au Senegal, la mediation, la fiscalite, les flux de paiement, les commissions, les exclusions de responsabilite et les verticales reglementees.",
    },
  ],
};

