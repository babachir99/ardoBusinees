export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  note?: string;
};

export type LegalDocument = {
  slug: string;
  title: string;
  subtitle: string;
  intro?: string[];
  sections: LegalSection[];
};

