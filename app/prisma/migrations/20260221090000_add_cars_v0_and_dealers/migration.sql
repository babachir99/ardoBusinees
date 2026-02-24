-- CARS vertical enums
DO $$ BEGIN
  CREATE TYPE "marketplace"."CarListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CarFuelType" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CarGearbox" AS ENUM ('MANUAL', 'AUTO', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CarPublisherType" AS ENUM ('INDIVIDUAL', 'DEALER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CarPublisherMemberRole" AS ENUM ('OWNER', 'AGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CarPublisherStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Dealers / publishers
CREATE TABLE IF NOT EXISTS "marketplace"."CarPublisher" (
  "id" TEXT NOT NULL,
  "type" "marketplace"."CarPublisherType" NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "marketplace"."CarPublisherStatus" NOT NULL DEFAULT 'ACTIVE',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "country" TEXT,
  "city" TEXT,
  "logoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarPublisher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "marketplace"."CarListing" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "publisherId" TEXT,
  "status" "marketplace"."CarListingStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "country" TEXT NOT NULL DEFAULT 'SN',
  "city" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "mileageKm" INTEGER NOT NULL,
  "fuelType" "marketplace"."CarFuelType" NOT NULL,
  "gearbox" "marketplace"."CarGearbox" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "marketplace"."CarPublisherMember" (
  "id" TEXT NOT NULL,
  "publisherId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "marketplace"."CarPublisherMemberRole" NOT NULL DEFAULT 'AGENT',
  "status" "marketplace"."UserRoleStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarPublisherMember_pkey" PRIMARY KEY ("id")
);

-- Indexes and uniques
CREATE UNIQUE INDEX IF NOT EXISTS "CarPublisher_slug_key" ON "marketplace"."CarPublisher"("slug");
CREATE INDEX IF NOT EXISTS "CarPublisher_status_verified_idx" ON "marketplace"."CarPublisher"("status", "verified");
CREATE INDEX IF NOT EXISTS "CarPublisher_country_city_status_idx" ON "marketplace"."CarPublisher"("country", "city", "status");

CREATE INDEX IF NOT EXISTS "CarListing_status_createdAt_idx" ON "marketplace"."CarListing"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CarListing_country_city_status_idx" ON "marketplace"."CarListing"("country", "city", "status");
CREATE INDEX IF NOT EXISTS "CarListing_make_model_year_status_idx" ON "marketplace"."CarListing"("make", "model", "year", "status");
CREATE INDEX IF NOT EXISTS "CarListing_publisherId_status_idx" ON "marketplace"."CarListing"("publisherId", "status");
CREATE INDEX IF NOT EXISTS "CarListing_ownerId_status_createdAt_idx" ON "marketplace"."CarListing"("ownerId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CarPublisherMember_publisherId_userId_key" ON "marketplace"."CarPublisherMember"("publisherId", "userId");
CREATE INDEX IF NOT EXISTS "CarPublisherMember_userId_status_idx" ON "marketplace"."CarPublisherMember"("userId", "status");
CREATE INDEX IF NOT EXISTS "CarPublisherMember_publisherId_status_idx" ON "marketplace"."CarPublisherMember"("publisherId", "status");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "marketplace"."CarListing"
    ADD CONSTRAINT "CarListing_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarListing"
    ADD CONSTRAINT "CarListing_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."CarPublisher"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarPublisherMember"
    ADD CONSTRAINT "CarPublisherMember_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."CarPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarPublisherMember"
    ADD CONSTRAINT "CarPublisherMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
