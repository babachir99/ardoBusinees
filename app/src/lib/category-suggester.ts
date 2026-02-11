type CategoryLite = {
  id: string;
  name: string;
  slug: string;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type Suggestion = {
  id: string;
  label: string;
  score: number;
};

export type CategorySuggestionResult = {
  categorie_suggeree: string | null;
  confiance: number;
  mots_cles_detectes: string[];
  categories_alternatives: string[];
  explication: string;
  suggestions: Suggestion[];
};

type SemanticRule = {
  key: string;
  terms: string[];
  categoryHints: string[];
};

const BRAND_RULES = [
  "apple",
  "samsung",
  "huawei",
  "xiaomi",
  "nike",
  "adidas",
  "puma",
  "zara",
  "ikea",
  "toyota",
  "mercedes",
  "bmw",
  "peugeot",
  "renault",
  "hp",
  "dell",
  "lenovo",
  "asus",
  "loreal",
  "maybelline",
  "nivea",
  "garnier",
  "dior",
];

const SEMANTIC_RULES: SemanticRule[] = [
  {
    key: "smartphone",
    terms: ["iphone", "smartphone", "mobile", "telephone", "android", "galaxy", "redmi"],
    categoryHints: ["telephone", "telephonie", "mobile", "smartphone", "electronique"],
  },
  {
    key: "laptop",
    terms: ["ordinateur", "laptop", "pc", "macbook", "notebook"],
    categoryHints: ["informatique", "ordinateur", "electronique"],
  },
  {
    key: "vetement",
    terms: ["robe", "pull", "tshirt", "tee", "jean", "pantalon", "chemise", "veste"],
    categoryHints: ["mode", "vetement", "habillement", "enfant"],
  },
  {
    key: "chaussure",
    terms: ["chaussure", "sneaker", "basket", "airmax", "sandale", "bottine"],
    categoryHints: ["chaussure", "mode", "sport"],
  },
  {
    key: "cosmetique",
    terms: [
      "cosmetique",
      "beaute",
      "maquillage",
      "rouge",
      "levres",
      "fond",
      "teint",
      "serum",
      "creme",
      "parfum",
      "shampooing",
      "hygiene",
      "skincare",
      "soin",
      "cheveux",
    ],
    categoryHints: ["cosmetique", "maquillage", "soins", "parfum", "cheveux", "hygiene", "beaute"],
  },
  {
    key: "voiture",
    terms: ["voiture", "auto", "vehicule", "car", "moto", "suv", "berline"],
    categoryHints: ["cars", "voiture", "auto", "vehicule", "moto"],
  },
  {
    key: "maison",
    terms: ["canape", "table", "chaise", "meuble", "matelas", "armoire", "deco"],
    categoryHints: ["maison", "meuble", "deco", "interieur"],
  },
  {
    key: "immo",
    terms: ["appartement", "villa", "terrain", "location", "studio", "maison"],
    categoryHints: ["immo", "immobilier", "location", "vente"],
  },
  {
    key: "sport",
    terms: ["velo", "football", "ballon", "raquette", "fitness", "halteres"],
    categoryHints: ["sport", "loisirs"],
  },
  {
    key: "jeu-video",
    terms: ["ps5", "playstation", "xbox", "switch", "fifa", "fc25", "manette"],
    categoryHints: ["jeu", "gaming", "console", "video"],
  },
  {
    key: "vacances",
    terms: ["vacances", "chalet", "hotel", "camping", "hebergement", "villa"],
    categoryHints: ["vacances", "location", "saisonnier"],
  },
  {
    key: "emploi",
    terms: ["emploi", "recrutement", "cdi", "cdd", "interim", "stage", "mission"],
    categoryHints: ["emploi", "services"],
  },
  {
    key: "services",
    terms: ["service", "prestataire", "depannage", "livraison", "coiffure", "menage", "cours", "formation"],
    categoryHints: ["service", "presta", "reparation", "personne"],
  },
  {
    key: "transport-colis",
    terms: ["colis", "transport", "gp", "expedition", "livreur", "moto"],
    categoryHints: ["transport", "colis", "livraison", "tiak", "gp"],
  },
  {
    key: "animaux",
    terms: ["chien", "chat", "chiot", "animal", "oiseau", "perroquet", "aquarium"],
    categoryHints: ["animaux", "accessoires"],
  },
  {
    key: "materiel-pro",
    terms: ["tracteur", "btp", "chantier", "industriel", "levage", "poids", "lourds"],
    categoryHints: ["materiel", "pro", "industriel", "btp"],
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function labelForCategory(category: CategoryLite) {
  return category.parent ? `${category.parent.name} > ${category.name}` : category.name;
}

function splitTokens(value: string) {
  return value
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildNgrams(tokens: string[]) {
  const grams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  for (let i = 0; i < tokens.length - 2; i += 1) {
    grams.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return grams;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function suggestCategoriesFromTitle(
  title: string,
  categories: CategoryLite[]
): CategorySuggestionResult {
  const normalizedTitle = normalize(title);
  const tokens = splitTokens(normalizedTitle);
  const ngrams = buildNgrams(tokens);
  const searchTerms = Array.from(new Set([...tokens, ...ngrams]));

  if (!normalizedTitle || categories.length === 0) {
    return {
      categorie_suggeree: null,
      confiance: 0,
      mots_cles_detectes: [],
      categories_alternatives: [],
      explication:
        "Aucune suggestion disponible sans titre ou sans categorie active.",
      suggestions: [],
    };
  }

  const detectedBrands = BRAND_RULES.filter((brand) =>
    normalizedTitle.includes(brand)
  );
  const detectedSemantics = SEMANTIC_RULES.filter((rule) =>
    rule.terms.some((term) => normalizedTitle.includes(term))
  );

  const detectedKeywords = Array.from(
    new Set([
      ...detectedBrands,
      ...detectedSemantics.flatMap((rule) =>
        rule.terms.filter((term) => normalizedTitle.includes(term)).slice(0, 2)
      ),
      ...tokens.filter((token) => token.length >= 4).slice(0, 4),
    ])
  ).slice(0, 10);

  const scored = categories
    .map((category) => {
      const bag = normalize(
        `${category.parent?.name ?? ""} ${category.parent?.slug ?? ""} ${category.name} ${category.slug}`
      );
      let score = 0;

      for (const term of searchTerms) {
        if (bag.includes(term)) score += term.includes(" ") ? 8 : 4;
        if (bag.startsWith(term)) score += 2;
        if (category.slug === term) score += 6;
      }

      for (const rule of detectedSemantics) {
        for (const hint of rule.categoryHints) {
          if (bag.includes(hint)) score += 9;
        }
      }

      for (const brand of detectedBrands) {
        if (bag.includes(brand)) score += 6;
      }

      return { category, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const topSuggestions = scored.slice(0, 5).map((entry) => ({
    id: entry.category.id,
    label: labelForCategory(entry.category),
    score: entry.score,
  }));

  if (topSuggestions.length === 0) {
    return {
      categorie_suggeree: null,
      confiance: 20,
      mots_cles_detectes: detectedKeywords,
      categories_alternatives: [],
      explication:
        "Des mots-cles ont ete detectes, mais aucun alignement fort avec les categories existantes.",
      suggestions: [],
    };
  }

  const top = topSuggestions[0];
  const second = topSuggestions[1];
  const gap = second ? top.score - second.score : top.score;
  let confiance = clamp(
    Math.round(top.score * 2.4 + gap * 3 + (detectedKeywords.length > 0 ? 12 : 0)),
    35,
    98
  );

  if (top.score < 18) confiance = Math.min(confiance, 69);

  const categorie_suggeree = confiance > 70 ? top.label : null;
  const categories_alternatives = (confiance > 70
    ? topSuggestions.slice(1, 4)
    : topSuggestions.slice(0, 4)
  ).map((entry) => entry.label);

  const explicationParts = [
    `Mots detectes: ${detectedKeywords.join(", ") || "aucun mot-cle fort"}.`,
    `Correspondance la plus forte: "${top.label}" (score ${top.score}).`,
  ];
  if (second) {
    explicationParts.push(
      `Ecart avec l'alternative suivante: ${gap} point${gap > 1 ? "s" : ""}.`
    );
  }
  explicationParts.push(
    confiance > 70
      ? "Confiance elevee, categorie principale proposee."
      : "Confiance moderee, plusieurs options sont proposees."
  );

  return {
    categorie_suggeree,
    confiance,
    mots_cles_detectes: detectedKeywords,
    categories_alternatives,
    explication: explicationParts.join(" "),
    suggestions: topSuggestions,
  };
}



