-- Extend PaymentLedger context enum
DO $$ BEGIN
  ALTER TYPE "marketplace"."PaymentLedgerContextType" ADD VALUE IF NOT EXISTS 'CARS_MONETIZATION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create CARS monetization enums
DO $$ BEGIN
  CREATE TYPE "marketplace"."CarMonetizationKind" AS ENUM ('FEATURED', 'BOOST', 'BOOST_PACK_10', 'FEATURED_PACK_4', 'EXTRA_SLOTS_10');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CarMonetizationPurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend CarListing for monetization
ALTER TABLE "marketplace"."CarListing"
  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featuredUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "boostUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "monetizationUpdatedAt" TIMESTAMP(3);

-- Extend CarPublisher quota
ALTER TABLE "marketplace"."CarPublisher"
  ADD COLUMN IF NOT EXISTS "includedPublishedQuota" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "extraSlots" INTEGER NOT NULL DEFAULT 0;

-- Create CARS balances
CREATE TABLE IF NOT EXISTS "marketplace"."CarMonetizationBalance" (
  "publisherId" TEXT NOT NULL,
  "boostCredits" INTEGER NOT NULL DEFAULT 0,
  "featuredCredits" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarMonetizationBalance_pkey" PRIMARY KEY ("publisherId")
);

-- Create CARS purchases
CREATE TABLE IF NOT EXISTS "marketplace"."CarMonetizationPurchase" (
  "id" TEXT NOT NULL,
  "listingId" TEXT,
  "publisherId" TEXT NOT NULL,
  "kind" "marketplace"."CarMonetizationKind" NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "status" "marketplace"."CarMonetizationPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "paymentLedgerId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarMonetizationPurchase_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CarListing_status_featuredUntil_idx" ON "marketplace"."CarListing"("status", "featuredUntil");
CREATE INDEX IF NOT EXISTS "CarListing_status_boostUntil_idx" ON "marketplace"."CarListing"("status", "boostUntil");
CREATE INDEX IF NOT EXISTS "CarPublisher_verified_status_idx" ON "marketplace"."CarPublisher"("verified", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "CarMonetizationPurchase_paymentLedgerId_key" ON "marketplace"."CarMonetizationPurchase"("paymentLedgerId");
CREATE INDEX IF NOT EXISTS "CarMonetizationPurchase_status_kind_idx" ON "marketplace"."CarMonetizationPurchase"("status", "kind");
CREATE INDEX IF NOT EXISTS "CarMonetizationPurchase_listingId_createdAt_idx" ON "marketplace"."CarMonetizationPurchase"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "CarMonetizationPurchase_publisherId_createdAt_idx" ON "marketplace"."CarMonetizationPurchase"("publisherId", "createdAt");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "marketplace"."CarMonetizationBalance"
    ADD CONSTRAINT "CarMonetizationBalance_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."CarPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarMonetizationPurchase"
    ADD CONSTRAINT "CarMonetizationPurchase_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "marketplace"."CarListing"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarMonetizationPurchase"
    ADD CONSTRAINT "CarMonetizationPurchase_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."CarPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarMonetizationPurchase"
    ADD CONSTRAINT "CarMonetizationPurchase_paymentLedgerId_fkey"
    FOREIGN KEY ("paymentLedgerId") REFERENCES "marketplace"."PaymentLedger"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."CarMonetizationPurchase"
    ADD CONSTRAINT "CarMonetizationPurchase_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;