const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { hash } = require("bcryptjs");

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

async function main() {
  const email = "ousmane@gmail.com";
  const password = "123456";
  const displayName = "Ousmane";
  const sellerSlug = "ousmane-shop";
  const storeSlug = "boutique-ousmane";

  const passwordHash = await hash(password, 10);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: displayName,
      passwordHash,
      role: "SELLER",
      emailVerified: now,
      isActive: true,
    },
    create: {
      email,
      name: displayName,
      passwordHash,
      role: "SELLER",
      emailVerified: now,
      isActive: true,
      activityLogs: {
        create: [{ action: "USER_REGISTER", metadata: { method: "seed" } }],
      },
    },
  });

  const seller = await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    update: {
      displayName,
      slug: sellerSlug,
      status: "APPROVED",
    },
    create: {
      userId: user.id,
      displayName,
      slug: sellerSlug,
      status: "APPROVED",
      commissionRate: 10,
    },
    
  });

  const store = await prisma.store.upsert({
    where: { slug: storeSlug },
    update: {
      name: "Boutique Ousmane",
      isActive: true,
    },
    create: {
      name: "Boutique Ousmane",
      slug: storeSlug,
      type: "MARKETPLACE",
      isActive: true,
    },
  });

  console.log("Seller user:", user.email);
  console.log("Seller profile:", seller.id);
  console.log("Store:", store.id, store.slug);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
