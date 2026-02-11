import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const adapter = new PrismaPg({ connectionString: databaseUrl }, { schema });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({ adapter });
}

function hasRequiredDelegates(client: PrismaClient) {
  const runtimeClient = client as unknown as Record<string, unknown>;
  return (
    "productInquiry" in runtimeClient &&
    "productInquiryMessage" in runtimeClient &&
    "productOffer" in runtimeClient &&
    "userAddress" in runtimeClient
  );
}

const devClient = globalForPrisma.prisma;
const shouldRefreshDevClient =
  process.env.NODE_ENV !== "production" &&
  (!devClient || !hasRequiredDelegates(devClient));

export const prisma =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : shouldRefreshDevClient
      ? createPrismaClient()
      : (devClient as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
