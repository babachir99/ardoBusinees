-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."UserRoleType" AS ENUM (
    'CLIENT',
    'SELLER',
    'PRESTA_PROVIDER',
    'GP_CARRIER',
    'TIAK_COURIER',
    'IMMO_AGENT',
    'ADMIN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."UserRoleStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."ImmoListingType" AS ENUM ('SALE', 'RENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."ImmoPropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."ImmoListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."ImmoContactMode" AS ENUM ('INTERNAL_MESSAGE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketplace"."UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "marketplace"."UserRoleType" NOT NULL,
    "status" "marketplace"."UserRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketplace"."ImmoListing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "listingType" "marketplace"."ImmoListingType" NOT NULL,
    "propertyType" "marketplace"."ImmoPropertyType" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "surfaceM2" INTEGER NOT NULL,
    "rooms" INTEGER,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'SN',
    "addressHidden" BOOLEAN NOT NULL DEFAULT true,
    "contactMode" "marketplace"."ImmoContactMode" NOT NULL DEFAULT 'INTERNAL_MESSAGE',
    "status" "marketplace"."ImmoListingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImmoListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_role_key" ON "marketplace"."UserRoleAssignment"("userId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_status_idx" ON "marketplace"."UserRoleAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_status_country_city_idx" ON "marketplace"."ImmoListing"("status", "country", "city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_status_priceCents_idx" ON "marketplace"."ImmoListing"("status", "priceCents");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_status_surfaceM2_idx" ON "marketplace"."ImmoListing"("status", "surfaceM2");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_status_propertyType_idx" ON "marketplace"."ImmoListing"("status", "propertyType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_ownerId_status_createdAt_idx" ON "marketplace"."ImmoListing"("ownerId", "status", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."UserRoleAssignment"
    ADD CONSTRAINT "UserRoleAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoListing"
    ADD CONSTRAINT "ImmoListing_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
