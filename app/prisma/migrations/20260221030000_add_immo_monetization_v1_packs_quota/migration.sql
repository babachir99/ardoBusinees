DO $$ BEGIN
  ALTER TYPE "marketplace"."ImmoMonetizationKind" ADD VALUE IF NOT EXISTS 'BOOST_PACK_10';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "marketplace"."ImmoMonetizationKind" ADD VALUE IF NOT EXISTS 'FEATURED_PACK_4';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "marketplace"."ImmoMonetizationKind" ADD VALUE IF NOT EXISTS 'EXTRA_SLOTS_10';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "marketplace"."ImmoPublisher"
  ADD COLUMN IF NOT EXISTS "includedPublishedQuota" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "extraSlots" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "marketplace"."ImmoMonetizationBalance" (
  "publisherId" TEXT NOT NULL,
  "boostCredits" INTEGER NOT NULL DEFAULT 0,
  "featuredCredits" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImmoMonetizationBalance_pkey" PRIMARY KEY ("publisherId")
);

DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoMonetizationBalance"
    ADD CONSTRAINT "ImmoMonetizationBalance_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."ImmoPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
  ALTER COLUMN "listingId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
    DROP CONSTRAINT IF EXISTS "ImmoMonetizationPurchase_listingId_fkey";

  ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
    ADD CONSTRAINT "ImmoMonetizationPurchase_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "marketplace"."ImmoListing"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
