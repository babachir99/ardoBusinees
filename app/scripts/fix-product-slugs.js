const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const match = envContent.match(/^DATABASE_URL="?(.*?)"?$/m);
const databaseUrl = match ? match[1] : process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const adapter = new PrismaPg({ connectionString: databaseUrl }, { schema });
const prisma = new PrismaClient({ adapter });

async function ensureUniqueProductSlug(sellerId, baseSlug, excludeProductId) {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { sellerId_slug: { sellerId, slug: candidate } },
      select: { id: true },
    });

    if (!existing || existing.id === excludeProductId) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, sellerId: true, title: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;

  for (const product of products) {
    const baseSlug = slugify(product.slug || product.title) || "produit";
    const nextSlug = await ensureUniqueProductSlug(product.sellerId, baseSlug, product.id);

    if (nextSlug !== product.slug) {
      await prisma.product.update({
        where: { id: product.id },
        data: { slug: nextSlug },
      });
      updated += 1;
      console.log(`Updated ${product.id}: ${product.slug} -> ${nextSlug}`);
    }
  }

  console.log(`Done. Updated ${updated}/${products.length} product slug(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
