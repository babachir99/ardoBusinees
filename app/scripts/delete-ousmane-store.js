const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const line = envContent
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const databaseUrl = line
  ? line.split("=").slice(1).join("=").replace(/^\"|\"$/g, "")
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const adapter = new PrismaPg({ connectionString: databaseUrl }, { schema });
const prisma = new PrismaClient({ adapter });

async function main() {
  const store = await prisma.store.findUnique({
    where: { slug: "boutique-ousmane" },
    select: { id: true, slug: true },
  });

  if (!store) {
    console.log("Store not found: boutique-ousmane");
    return;
  }

  await prisma.product.updateMany({
    where: { storeId: store.id },
    data: { storeId: null },
  });

  await prisma.store.delete({
    where: { id: store.id },
  });

  console.log("Store deleted:", store.slug);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
