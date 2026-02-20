const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

function getDatabaseUrl() {
  const envPath = path.join(__dirname, "..", ".env");
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const match = envContent.match(/^DATABASE_URL="?(.*?)"?$/m);
  return match ? match[1] : process.env.DATABASE_URL;
}

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const adapter = new PrismaPg({ connectionString: databaseUrl }, { schema });
const prisma = new PrismaClient({ adapter });

const LEGACY_TO_MULTI = {
  ADMIN: "ADMIN",
  SELLER: "SELLER",
  CUSTOMER: "CLIENT",
  TRANSPORTER: "GP_CARRIER",
  COURIER: "TIAK_COURIER",
};

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, role: true },
  });

  const payload = users.map((user) => ({
    userId: user.id,
    role: LEGACY_TO_MULTI[user.role] ?? "CLIENT",
    status: "ACTIVE",
  }));

  const result = await prisma.userRoleAssignment.createMany({
    data: payload,
    skipDuplicates: true,
  });

  console.log(`Processed users: ${users.length}`);
  console.log(`Inserted role rows: ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
