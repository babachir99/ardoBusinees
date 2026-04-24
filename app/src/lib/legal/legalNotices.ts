import type { LegalDocument } from "@/lib/legal/types";

export const legalNoticesDocument: LegalDocument = {
  slug: "legal-notices",
  title: "Mentions legales",
  subtitle:
    "Base de publication des informations obligatoires relatives a l'editeur, a l'hebergement et aux contacts legaux.",
  sections: [
    {
      title: "1. Editeur du service",
      paragraphs: [
        "Les mentions legales doivent identifier clairement l'entite editrice de JONTAADO : denomination sociale, forme sociale, capital, siege social, numero d'immatriculation, NINEA, numero TVA le cas echeant, email et telephone de contact.",
      ],
      note:
        "A completer avant mise en ligne avec les informations exactes de l'entite editrice basee au Senegal.",
    },
    {
      title: "2. Direction de la publication",
      paragraphs: [
        "Les mentions legales doivent indiquer le directeur ou la directrice de publication ainsi que, si necessaire, le responsable de la redaction ou de l'exploitation editoriale.",
      ],
    },
    {
      title: "3. Hebergement",
      paragraphs: [
        "Le nom, la raison sociale, l'adresse et les coordonnees du prestataire d'hebergement doivent etre renseignes conformement aux exigences applicables.",
      ],
    },
    {
      title: "4. Activite de plateforme et obligations d'information",
      bullets: [
        "JONTAADO opere une place de marche en ligne et doit fournir une information loyale, claire et transparente sur ses conditions d'intermediation.",
        "Lorsque des vendeurs professionnels interviennent, les informations precontractuelles pertinentes doivent etre rendues accessibles aux consommateurs.",
        "Le caractere sponsorise ou mis en avant de certains contenus doit etre intelligible.",
      ],
    },
    {
      title: "5. Propriete intellectuelle",
      paragraphs: [
        "Sauf mention contraire, l'ensemble des elements composant la plateforme est protege. Toute reproduction, representation, adaptation ou extraction non autorisee est interdite, sous reserve des exceptions legales.",
      ],
    },
    {
      title: "6. Contact juridique",
      paragraphs: [
        "Les notifications legales, demandes relatives au droit d'auteur, questions de conformite et demandes d'exercice des droits doivent etre adressees au canal de contact juridique indique par l'editeur.",
      ],
    },
  ],
};

