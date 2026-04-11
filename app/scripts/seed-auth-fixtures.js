const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { hash } = require("bcryptjs");

function loadEnvFromDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFromDotEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const adapter = new PrismaPg({ connectionString: databaseUrl }, { schema });
const prisma = new PrismaClient({ adapter });

const seededPassword = process.env.QA_SEEDED_PASSWORD || "123456";
const emailVerified = new Date();

const fixtures = [
  { email: "bachir.ba.bb@gmail.com", name: "Bachir", role: "CUSTOMER", locale: "fr" },
  { email: "admin@ardobusiness.com", name: "Admin", role: "ADMIN", locale: "fr" },
  { email: "seller@ardobusiness.com", name: "Nova Supply", role: "SELLER", locale: "fr" },
  { email: "ousmane@gmail.com", name: "Ousmane", role: "CUSTOMER", locale: "fr" },
  { email: "awa@gmail.com", name: "Awa AMAR", role: "CUSTOMER", locale: "fr" },
  { email: "amy@gmail.com", name: "Amy", role: "CUSTOMER", locale: "fr" },
  { email: "malick@gmail.com", name: "Malick", role: "CUSTOMER", locale: "fr" },
];

const roleAssignmentByRole = {
  ADMIN: "ADMIN",
  SELLER: "SELLER",
  CUSTOMER: "CLIENT",
  TRANSPORTER: "GP_CARRIER",
  COURIER: "TIAK_COURIER",
};

async function main() {
  const passwordHash = await hash(seededPassword, 10);

  for (const fixture of fixtures) {
    const user = await prisma.user.upsert({
      where: { email: fixture.email },
      update: {
        name: fixture.name,
        role: fixture.role,
        locale: fixture.locale,
        emailVerified,
        passwordHash,
      },
      create: {
        email: fixture.email,
        name: fixture.name,
        role: fixture.role,
        locale: fixture.locale,
        emailVerified,
        passwordHash,
      },
    });

    const roleType = roleAssignmentByRole[fixture.role] || "CLIENT";
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_role: {
          userId: user.id,
          role: roleType,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        userId: user.id,
        role: roleType,
        status: "ACTIVE",
      },
    });

    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        transactionalEmailEnabled: true,
        marketingEmailEnabled: false,
        priceDropEmailEnabled: false,
        dealsEmailEnabled: false,
        messageAutoEnabled: true,
      },
    });

    if (fixture.email === "seller@ardobusiness.com") {
      await prisma.sellerProfile.upsert({
        where: { userId: user.id },
        update: {
          displayName: "Nova Supply",
          slug: "nova-supply",
          status: "APPROVED",
          commissionRate: 12,
        },
        create: {
          userId: user.id,
          displayName: "Nova Supply",
          slug: "nova-supply",
          status: "APPROVED",
          commissionRate: 12,
        },
      });
    }
  }

  console.log(
    `[qa:seed-auth-fixtures] seeded ${fixtures.length} auth fixtures with verified emails`
  );
}

main()
  .catch((error) => {
    console.error("[qa:seed-auth-fixtures] FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
