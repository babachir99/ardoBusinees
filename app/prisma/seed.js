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
    update: { name: "JONTAADO Marketplace", type: "MARKETPLACE" },
    create: {
      name: "JONTAADO Marketplace",
      slug: "marketplace",
      type: "MARKETPLACE",
    },
  });

  await prisma.store.upsert({
    where: { slug: "jontaado-immo" },
    update: { name: "JONTAADO IMMO", type: "IMMO" },
    create: { name: "JONTAADO IMMO", slug: "jontaado-immo", type: "IMMO" },
  });

  await prisma.store.upsert({
    where: { slug: "jontaado-cars" },
    update: { name: "JONTAADO CARS", type: "CARS" },
    create: { name: "JONTAADO CARS", slug: "jontaado-cars", type: "CARS" },
  });

  await prisma.store.upsert({
    where: { slug: "jontaado-presta" },
    update: { name: "JONTAADO PRESTA", type: "PRESTA" },
    create: { name: "JONTAADO PRESTA", slug: "jontaado-presta", type: "PRESTA" },
  });

  await prisma.store.upsert({
    where: { slug: "jontaado-tiak-tiak" },
    update: { name: "JONTAADO TIAK TIAK", type: "TIAK_TIAK" },
    create: {
      name: "JONTAADO TIAK TIAK",
      slug: "jontaado-tiak-tiak",
      type: "TIAK_TIAK",
    },
  });

  await prisma.store.upsert({
    where: { slug: "jontaado-gp" },
    update: { name: "JONTAADO GP", type: "GP" },
    create: { name: "JONTAADO GP", slug: "jontaado-gp", type: "GP" },
  });

  const catTech = await prisma.category.upsert({
    where: { slug: "tech" },
    update: { name: "Tech" },
    create: { name: "Tech", slug: "tech" },
  });

  const catLifestyle = await prisma.category.upsert({
    where: { slug: "lifestyle" },
    update: { name: "Lifestyle" },
    create: { name: "Lifestyle", slug: "lifestyle" },
  });

  const catLocal = await prisma.category.upsert({
    where: { slug: "local" },
    update: { name: "Local" },
    create: { name: "Local", slug: "local" },
  });

  const atlas = await prisma.product.upsert({
    where: { sellerId_slug: { sellerId: seller.id, slug: "atlas-headphones" } },
    update: {
      title: "Atlas Studio Headphones",
      priceCents: 89000,
      type: "DROPSHIP",
      dropshipSupplier: "Nova Logistics",
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

  await prisma.product.upsert({
    where: { sellerId_slug: { sellerId: seller.id, slug: "lune-smartwatch" } },
    update: {
      title: "Lune Smartwatch Pro",
      priceCents: 65500,
      type: "PREORDER",
      preorderLeadDays: 14,
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

  await prisma.productCategory.createMany({
    data: [
      { productId: atlas.id, categoryId: catTech.id },
      { productId: atlas.id, categoryId: catLifestyle.id },
      { productId: localProduct.id, categoryId: catLocal.id },
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

  return { admin, seller, customer, orderId: order.id };
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
