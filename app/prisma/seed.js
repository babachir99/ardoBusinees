const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const schema =
  new URL(databaseUrl).searchParams.get("schema") ?? "public";

const adapter = new PrismaPg(
  { connectionString: databaseUrl },
  { schema }
);

const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@ardobusiness.com" },
    update: { role: "ADMIN", name: "Admin" },
    create: {
      email: "admin@ardobusiness.com",
      name: "Admin",
      role: "ADMIN",
      locale: "fr",
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@ardobusiness.com" },
    update: { role: "SELLER", name: "Nova Supply" },
    create: {
      email: "seller@ardobusiness.com",
      name: "Nova Supply",
      role: "SELLER",
      locale: "fr",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "client@ardobusiness.com" },
    update: { role: "CUSTOMER", name: "Awa Diallo" },
    create: {
      email: "client@ardobusiness.com",
      name: "Awa Diallo",
      role: "CUSTOMER",
      locale: "fr",
    },
  });



  const transporterUser = await prisma.user.upsert({
    where: { email: "transporter@ardobusiness.com" },
    update: {
      role: "TRANSPORTER",
      name: "Mamadou GP",
      phone: "+221770001122",
    },
    create: {
      email: "transporter@ardobusiness.com",
      name: "Mamadou GP",
      role: "TRANSPORTER",
      phone: "+221770001122",
      locale: "fr",
    },
  });

  const seller = await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {
      displayName: "Nova Supply",
      slug: "nova-supply",
      status: "APPROVED",
      commissionRate: 12,
    },
    create: {
      userId: sellerUser.id,
      displayName: "Nova Supply",
      slug: "nova-supply",
      status: "APPROVED",
      commissionRate: 12,
    },
  });

  const marketplaceStore = await prisma.store.upsert({
    where: { slug: "marketplace" },
    update: {
      name: "JONTAADO Marketplace",
      type: "MARKETPLACE",
      description: "Boutique principale multi-categories JONTAADO.",
    },
    create: {
      name: "JONTAADO Marketplace",
      slug: "marketplace",
      type: "MARKETPLACE",
      description: "Boutique principale multi-categories JONTAADO.",
    },
  });

  const immoStore = await prisma.store.upsert({
    where: { slug: "jontaado-immo" },
    update: { name: "JONTAADO IMMO", type: "IMMO" },
    create: { name: "JONTAADO IMMO", slug: "jontaado-immo", type: "IMMO" },
  });

  const carsStore = await prisma.store.upsert({
    where: { slug: "jontaado-cars" },
    update: { name: "JONTAADO CARS", type: "CARS" },
    create: { name: "JONTAADO CARS", slug: "jontaado-cars", type: "CARS" },
  });

  const prestaStore = await prisma.store.upsert({
    where: { slug: "jontaado-presta" },
    update: { name: "JONTAADO PRESTA", type: "PRESTA" },
    create: { name: "JONTAADO PRESTA", slug: "jontaado-presta", type: "PRESTA" },
  });

  const tiakStore = await prisma.store.upsert({
    where: { slug: "jontaado-tiak-tiak" },
    update: { name: "JONTAADO TIAK TIAK", type: "TIAK_TIAK" },
    create: {
      name: "JONTAADO TIAK TIAK",
      slug: "jontaado-tiak-tiak",
      type: "TIAK_TIAK",
    },
  });

  const gpStore = await prisma.store.upsert({
    where: { slug: "jontaado-gp" },
    update: { name: "JONTAADO GP", type: "GP" },
    create: { name: "JONTAADO GP", slug: "jontaado-gp", type: "GP" },
  });

  const storesBySlug = {
    marketplace: marketplaceStore,
    "jontaado-immo": immoStore,
    "jontaado-cars": carsStore,
    "jontaado-presta": prestaStore,
    "jontaado-tiak-tiak": tiakStore,
    "jontaado-gp": gpStore,
  };

  const categoryCatalog = [
    { slug: "immobilier", name: "Immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "vehicules", name: "Vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vacances", name: "Vacances", storeSlugs: ["marketplace"] },
    { slug: "emploi", name: "Emploi", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "mode", name: "Mode", storeSlugs: ["marketplace"] },
    { slug: "cosmetique", name: "Cosmetique", storeSlugs: ["marketplace"] },
    { slug: "maison-jardin", name: "Maison & Jardin", storeSlugs: ["marketplace"] },
    { slug: "famille", name: "Famille", storeSlugs: ["marketplace"] },
    { slug: "electronique", name: "Electronique", storeSlugs: ["marketplace"] },
    { slug: "loisirs", name: "Loisirs", storeSlugs: ["marketplace"] },
    {
      slug: "services",
      name: "Services",
      storeSlugs: ["marketplace", "jontaado-presta", "jontaado-tiak-tiak", "jontaado-gp"],
    },
    { slug: "animaux", name: "Animaux", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro", name: "Materiel professionnel", storeSlugs: ["marketplace"] },
    { slug: "autres", name: "Autres", storeSlugs: ["marketplace"] },
    { slug: "bons-plans", name: "Bons plans", storeSlugs: ["marketplace"] },

    { slug: "immobilier-vente-appartement", name: "Appartement a vendre", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-vente-maison", name: "Maison a vendre", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-terrain", name: "Terrain", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-location-appartement", name: "Appartement a louer", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-location-maison", name: "Maison a louer", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-colocation", name: "Colocation", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-bureaux-commerces", name: "Bureaux & Commerces", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-neuf", name: "Immobilier neuf", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },
    { slug: "immobilier-demenagement", name: "Services de demenagement", parentSlug: "immobilier", storeSlugs: ["jontaado-immo", "marketplace"] },

    { slug: "vehicules-voitures", name: "Voitures", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-motos", name: "Motos", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-utilitaires", name: "Utilitaires", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-camions", name: "Camions", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-nautisme", name: "Nautisme", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-caravaning", name: "Caravaning", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-equipements-auto", name: "Equipement auto", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-equipements-moto", name: "Equipement moto", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-equipements-velo", name: "Equipements velos", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },
    { slug: "vehicules-reparations", name: "Services de reparations mecaniques", parentSlug: "vehicules", storeSlugs: ["jontaado-cars", "marketplace"] },

    { slug: "vacances-hebergements", name: "Hebergements", parentSlug: "vacances", storeSlugs: ["marketplace"] },
    { slug: "vacances-maisons-villas", name: "Maisons et villas", parentSlug: "vacances", storeSlugs: ["marketplace"] },
    { slug: "vacances-appartements", name: "Appartements", parentSlug: "vacances", storeSlugs: ["marketplace"] },
    { slug: "vacances-chalets", name: "Chalets", parentSlug: "vacances", storeSlugs: ["marketplace"] },
    { slug: "vacances-campings", name: "Campings", parentSlug: "vacances", storeSlugs: ["marketplace"] },
    { slug: "vacances-activites", name: "Activites", parentSlug: "vacances", storeSlugs: ["marketplace"] },

    { slug: "emploi-offres", name: "Offres d'emploi", parentSlug: "emploi", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "emploi-cdi-cdd-interim", name: "CDI / CDD / Interim", parentSlug: "emploi", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "emploi-independant-stage", name: "Independant / Stage / Apprentissage", parentSlug: "emploi", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "emploi-formations", name: "Formations professionnelles", parentSlug: "emploi", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "emploi-profil-candidat", name: "Profil candidat", parentSlug: "emploi", storeSlugs: ["marketplace", "jontaado-presta"] },

    { slug: "mode-vetements-femme", name: "Vetements femme", parentSlug: "mode", storeSlugs: ["marketplace"] },
    { slug: "mode-vetements-homme", name: "Vetements homme", parentSlug: "mode", storeSlugs: ["marketplace"] },
    { slug: "mode-vetements-enfant", name: "Vetements enfant", parentSlug: "mode", storeSlugs: ["marketplace"] },
    { slug: "mode-vetements-maternite", name: "Vetements maternite", parentSlug: "mode", storeSlugs: ["marketplace"] },
    { slug: "mode-chaussures", name: "Chaussures", parentSlug: "mode", storeSlugs: ["marketplace"] },
    { slug: "mode-montres-bijoux", name: "Montres & Bijoux", parentSlug: "mode", storeSlugs: ["marketplace"] },
    { slug: "mode-accessoires-bagagerie", name: "Accessoires & Bagagerie", parentSlug: "mode", storeSlugs: ["marketplace"] },

    { slug: "cosmetique-maquillage", name: "Maquillage", parentSlug: "cosmetique", storeSlugs: ["marketplace"] },
    { slug: "cosmetique-soins-visage", name: "Soins visage", parentSlug: "cosmetique", storeSlugs: ["marketplace"] },
    { slug: "cosmetique-soins-corps", name: "Soins corps", parentSlug: "cosmetique", storeSlugs: ["marketplace"] },
    { slug: "cosmetique-cheveux", name: "Cheveux", parentSlug: "cosmetique", storeSlugs: ["marketplace"] },
    { slug: "cosmetique-parfums", name: "Parfums", parentSlug: "cosmetique", storeSlugs: ["marketplace"] },
    { slug: "cosmetique-hygiene", name: "Hygiene", parentSlug: "cosmetique", storeSlugs: ["marketplace"] },

    { slug: "maison-meubles", name: "Ameublement", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-electromenager", name: "Electromenager", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-decoration", name: "Decoration", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-linge", name: "Linge de maison", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-arts-table", name: "Arts de la table", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-papeterie", name: "Papeterie & Fournitures", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-jardin-bricolage", name: "Jardin & Bricolage", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },
    { slug: "maison-services-jardin", name: "Services de jardinage & bricolage", parentSlug: "maison-jardin", storeSlugs: ["marketplace"] },

    { slug: "famille-bebe", name: "Equipement bebe", parentSlug: "famille", storeSlugs: ["marketplace"] },
    { slug: "famille-vetements-bebe", name: "Vetements bebe", parentSlug: "famille", storeSlugs: ["marketplace"] },
    { slug: "famille-vetements-enfants", name: "Vetements enfants", parentSlug: "famille", storeSlugs: ["marketplace"] },
    { slug: "famille-mobilier-enfant", name: "Mobilier enfant", parentSlug: "famille", storeSlugs: ["marketplace"] },
    { slug: "famille-jouets", name: "Jeux & Jouets", parentSlug: "famille", storeSlugs: ["marketplace"] },
    { slug: "famille-baby-sitting", name: "Baby-Sitting", parentSlug: "famille", storeSlugs: ["marketplace", "jontaado-presta"] },

    { slug: "electronique-smartphones", name: "Telephones", parentSlug: "electronique", storeSlugs: ["marketplace"] },
    { slug: "electronique-accessoires-smartphones", name: "Accessoires telephone", parentSlug: "electronique", storeSlugs: ["marketplace"] },
    { slug: "electronique-ordinateurs", name: "Ordinateurs", parentSlug: "electronique", storeSlugs: ["marketplace"] },
    { slug: "electronique-tablettes", name: "Tablettes & Liseuses", parentSlug: "electronique", storeSlugs: ["marketplace"] },
    { slug: "electronique-audio-video", name: "Photo, audio & video", parentSlug: "electronique", storeSlugs: ["marketplace"] },
    { slug: "electronique-consoles", name: "Consoles & jeux video", parentSlug: "electronique", storeSlugs: ["marketplace"] },
    { slug: "electronique-reparations", name: "Services de reparations electroniques", parentSlug: "electronique", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "electronique-electromenager", name: "Electromenager", parentSlug: "electronique", storeSlugs: ["marketplace"] },

    { slug: "loisirs-antiquites", name: "Antiquites", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-artistes-musiciens", name: "Artistes & Musiciens", parentSlug: "loisirs", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "loisirs-billetterie", name: "Billetterie", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-collection", name: "Collection", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-livres", name: "Livres", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-musique", name: "Instruments de musique", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-jeux-jouets", name: "Jeux & Jouets", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-sport", name: "Sport & Plein air", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-velos", name: "Velos", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-equipements-velos", name: "Equipements velos", parentSlug: "loisirs", storeSlugs: ["marketplace"] },
    { slug: "loisirs-creatifs", name: "Loisirs creatifs", parentSlug: "loisirs", storeSlugs: ["marketplace"] },

    { slug: "services-prestations", name: "Prestations", parentSlug: "services", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "services-livraison", name: "Livraison locale", parentSlug: "services", storeSlugs: ["jontaado-tiak-tiak", "marketplace"] },
    { slug: "services-transport-colis", name: "Transport de colis (GP)", parentSlug: "services", storeSlugs: ["jontaado-gp", "marketplace"] },
    { slug: "services-evenementiel", name: "Services evenementiels", parentSlug: "services", storeSlugs: ["jontaado-presta", "marketplace"] },
    { slug: "services-personne", name: "Services a la personne", parentSlug: "services", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "services-animaux", name: "Services aux animaux", parentSlug: "services", storeSlugs: ["marketplace", "jontaado-presta"] },
    { slug: "services-cours", name: "Cours particuliers", parentSlug: "services", storeSlugs: ["marketplace", "jontaado-presta"] },

    { slug: "animaux-animaux", name: "Animaux", parentSlug: "animaux", storeSlugs: ["marketplace"] },
    { slug: "animaux-accessoires", name: "Accessoires animaux", parentSlug: "animaux", storeSlugs: ["marketplace"] },
    { slug: "animaux-perdus", name: "Animaux perdus", parentSlug: "animaux", storeSlugs: ["marketplace"] },

    { slug: "materiel-pro-tracteurs", name: "Tracteurs", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro-agricole", name: "Materiel agricole", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro-btp", name: "BTP - Chantier gros-oeuvre", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro-poids-lourds", name: "Poids lourds", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro-industriel", name: "Equipements industriels", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro-restauration", name: "Equipements restauration & hotellerie", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },
    { slug: "materiel-pro-medical", name: "Materiel medical", parentSlug: "materiel-pro", storeSlugs: ["marketplace"] },

    { slug: "autres-dons", name: "Dons", parentSlug: "autres", storeSlugs: ["marketplace"] },
    { slug: "autres-entraide", name: "Entraide", parentSlug: "autres", storeSlugs: ["marketplace"] },
    { slug: "autres-divers", name: "Divers", parentSlug: "autres", storeSlugs: ["marketplace"] },

    { slug: "bons-plans-promotions", name: "Promotions", parentSlug: "bons-plans", storeSlugs: ["marketplace"] },
    { slug: "bons-plans-neuf", name: "Produits neufs", parentSlug: "bons-plans", storeSlugs: ["marketplace"] },
    { slug: "bons-plans-fin-serie", name: "Fin de serie", parentSlug: "bons-plans", storeSlugs: ["marketplace"] },
  ];

  const categoriesBySlug = new Map();

  for (const item of categoryCatalog.filter((entry) => !entry.parentSlug)) {
    const category = await prisma.category.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        parentId: null,
        isActive: true,
      },
      create: {
        name: item.name,
        slug: item.slug,
        isActive: true,
      },
    });
    categoriesBySlug.set(item.slug, category);
  }

  for (const item of categoryCatalog.filter((entry) => entry.parentSlug)) {
    const parent = categoriesBySlug.get(item.parentSlug);
    if (!parent) continue;

    const category = await prisma.category.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        parentId: parent.id,
        isActive: true,
      },
      create: {
        name: item.name,
        slug: item.slug,
        parent: { connect: { id: parent.id } },
        isActive: true,
      },
    });
    categoriesBySlug.set(item.slug, category);
  }

  await prisma.storeCategory.deleteMany({});

  const storeCategoryRows = [];
  for (const item of categoryCatalog) {
    const category = categoriesBySlug.get(item.slug);
    if (!category || !Array.isArray(item.storeSlugs)) continue;

    for (const storeSlug of item.storeSlugs) {
      const store = storesBySlug[storeSlug];
      if (!store) continue;
      storeCategoryRows.push({ storeId: store.id, categoryId: category.id });
    }
  }

  if (storeCategoryRows.length > 0) {
    await prisma.storeCategory.createMany({
      data: storeCategoryRows,
      skipDuplicates: true,
    });
  }

  const catElectronicsAudio = categoriesBySlug.get("electronique-audio-video");
  const catElectronicsPhones = categoriesBySlug.get("electronique-smartphones");
  const catMaisonDeco = categoriesBySlug.get("maison-decoration");

  const atlas = await prisma.product.upsert({
    where: { sellerId_slug: { sellerId: seller.id, slug: "atlas-headphones" } },
    update: {
      title: "Atlas Studio Headphones",
      priceCents: 89000,
      type: "DROPSHIP",
      dropshipSupplier: "Nova Logistics",
      storeId: marketplaceStore.id,
    },
    create: {
      sellerId: seller.id,
      storeId: marketplaceStore.id,
      title: "Atlas Studio Headphones",
      slug: "atlas-headphones",
      description: "Audio premium, confort longue duree.",
      priceCents: 89000,
      type: "DROPSHIP",
      dropshipSupplier: "Nova Logistics",
    },
  });

  const lune = await prisma.product.upsert({
    where: { sellerId_slug: { sellerId: seller.id, slug: "lune-smartwatch" } },
    update: {
      title: "Lune Smartwatch Pro",
      priceCents: 65500,
      type: "PREORDER",
      preorderLeadDays: 14,
      storeId: marketplaceStore.id,
    },
    create: {
      sellerId: seller.id,
      storeId: marketplaceStore.id,
      title: "Lune Smartwatch Pro",
      slug: "lune-smartwatch",
      description: "Montre connectee en precommande.",
      priceCents: 65500,
      type: "PREORDER",
      preorderLeadDays: 14,
    },
  });

  const localProduct = await prisma.product.upsert({
    where: { sellerId_slug: { sellerId: seller.id, slug: "jonta-basket" } },
    update: {
      title: "Panier artisanal Jonta",
      priceCents: 18000,
      type: "LOCAL",
      stockQuantity: 12,
      pickupLocation: "Dakar - Medina",
      deliveryOptions: "Retrait ou livraison locale",
      storeId: marketplaceStore.id,
    },
    create: {
      sellerId: seller.id,
      storeId: marketplaceStore.id,
      title: "Panier artisanal Jonta",
      slug: "jonta-basket",
      description: "Produit local fait main.",
      priceCents: 18000,
      type: "LOCAL",
      stockQuantity: 12,
      pickupLocation: "Dakar - Medina",
      deliveryOptions: "Retrait ou livraison locale",
    },
  });

  await prisma.productCategory.deleteMany({
    where: {
      productId: { in: [atlas.id, lune.id, localProduct.id] },
    },
  });

  await prisma.productCategory.createMany({
    data: [
      ...(catElectronicsAudio ? [{ productId: atlas.id, categoryId: catElectronicsAudio.id }] : []),
      ...(catElectronicsPhones ? [{ productId: lune.id, categoryId: catElectronicsPhones.id }] : []),
      ...(catMaisonDeco ? [{ productId: localProduct.id, categoryId: catMaisonDeco.id }] : []),
    ],
    skipDuplicates: true,
  });

  await prisma.serviceListing.upsert({
    where: { id: "svc-branding" },
    update: {
      title: "Branding express",
      priceCents: 45000,
      isActive: true,
    },
    create: {
      id: "svc-branding",
      sellerId: seller.id,
      title: "Branding express",
      description: "Identite visuelle rapide pour entrepreneurs.",
      priceCents: 45000,
    },
  });

  const order = await prisma.order.upsert({
    where: { id: "order-demo" },
    update: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      subtotalCents: 154500,
      feesCents: 6500,
      totalCents: 161000,
    },
    create: {
      id: "order-demo",
      userId: customer.id,
      sellerId: seller.id,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      subtotalCents: 154500,
      feesCents: 6500,
      totalCents: 161000,
      items: {
        create: [
          {
            productId: atlas.id,
            quantity: 1,
            unitPriceCents: 89000,
            type: "DROPSHIP",
          },
        ],
      },
      payment: {
        create: {
          provider: "paydunya",
          providerRef: "PDY-DEMO-001",
          amountCents: 161000,
          status: "PAID",
          splitMeta: { sellerShare: 142000, platformFee: 19000 },
        },
      },
      payouts: {
        create: [
          {
            sellerId: seller.id,
            amountCents: 142000,
            status: "PAID",
            providerRef: "PDY-PAYOUT-001",
          },
        ],
      },
    },
  });

  await prisma.serviceBooking.upsert({
    where: { id: "booking-demo" },
    update: {
      status: "CONFIRMED",
      priceCents: 45000,
    },
    create: {
      id: "booking-demo",
      serviceId: "svc-branding",
      customerId: customer.id,
      status: "CONFIRMED",
      priceCents: 45000,
    },
  });



  const gpTrip = await prisma.gpTrip.upsert({
    where: { id: "gp-trip-demo" },
    update: {
      transporterId: transporterUser.id,
      storeId: gpStore.id,
      originCity: "Paris",
      originAddress: "Aeroport CDG",
      destinationCity: "Dakar",
      destinationAddress: "Aeroport Blaise Diagne",
      airline: "Air Senegal",
      flightNumber: "HC404",
      flightDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryStartAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      deliveryEndAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      availableKg: 24,
      pricePerKgCents: 3500,
      maxPackages: 6,
      acceptedPaymentMethods: ["WAVE", "ORANGE_MONEY"],
      contactPhone: transporterUser.phone,
      notes: "Depot et remise sur rendez-vous.",
      status: "OPEN",
      isActive: true,
    },
    create: {
      id: "gp-trip-demo",
      transporterId: transporterUser.id,
      storeId: gpStore.id,
      originCity: "Paris",
      originAddress: "Aeroport CDG",
      destinationCity: "Dakar",
      destinationAddress: "Aeroport Blaise Diagne",
      airline: "Air Senegal",
      flightNumber: "HC404",
      flightDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryStartAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      deliveryEndAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      availableKg: 24,
      pricePerKgCents: 3500,
      maxPackages: 6,
      acceptedPaymentMethods: ["WAVE", "ORANGE_MONEY"],
      contactPhone: transporterUser.phone,
      notes: "Depot et remise sur rendez-vous.",
      status: "OPEN",
      isActive: true,
    },
  });


  return { admin, seller, customer, transporterUser, gpTripId: gpTrip.id, orderId: order.id };
}

main()
  .then(async (result) => {
    console.log("Seed complete:", result);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });


