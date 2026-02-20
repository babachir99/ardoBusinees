-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoFuelType" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoGearbox" AS ENUM ('MANUAL', 'AUTO', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketplace"."AutoListing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "marketplace"."AutoListingStatus" NOT NULL DEFAULT 'DRAFT',
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
    "fuelType" "marketplace"."AutoFuelType" NOT NULL,
    "gearbox" "marketplace"."AutoGearbox" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoListing_status_createdAt_idx" ON "marketplace"."AutoListing"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoListing_country_city_status_idx" ON "marketplace"."AutoListing"("country", "city", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoListing_make_model_year_status_idx" ON "marketplace"."AutoListing"("make", "model", "year", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoListing_ownerId_status_createdAt_idx" ON "marketplace"."AutoListing"("ownerId", "status", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoListing"
    ADD CONSTRAINT "AutoListing_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
