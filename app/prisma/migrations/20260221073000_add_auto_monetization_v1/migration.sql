-- Extend PaymentLedger context enum
DO $$ BEGIN
  ALTER TYPE "marketplace"."PaymentLedgerContextType" ADD VALUE IF NOT EXISTS 'AUTO_MONETIZATION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create AUTO monetization enums
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoMonetizationKind" AS ENUM ('FEATURED', 'BOOST', 'BOOST_PACK_10', 'FEATURED_PACK_4', 'EXTRA_SLOTS_10');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoMonetizationPurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend AutoListing for monetization
ALTER TABLE "marketplace"."AutoListing"
  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featuredUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "boostUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "monetizationUpdatedAt" TIMESTAMP(3);

-- Extend AutoPublisher quota
ALTER TABLE "marketplace"."AutoPublisher"
  ADD COLUMN IF NOT EXISTS "includedPublishedQuota" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "extraSlots" INTEGER NOT NULL DEFAULT 0;

-- Create AUTO balances
CREATE TABLE IF NOT EXISTS "marketplace"."AutoMonetizationBalance" (
  "publisherId" TEXT NOT NULL,
  "boostCredits" INTEGER NOT NULL DEFAULT 0,
  "featuredCredits" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoMonetizationBalance_pkey" PRIMARY KEY ("publisherId")
);

-- Create AUTO purchases
CREATE TABLE IF NOT EXISTS "marketplace"."AutoMonetizationPurchase" (
  "id" TEXT NOT NULL,
  "listingId" TEXT,
  "publisherId" TEXT NOT NULL,
  "kind" "marketplace"."AutoMonetizationKind" NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "status" "marketplace"."AutoMonetizationPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "paymentLedgerId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoMonetizationPurchase_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "AutoListing_status_featuredUntil_idx" ON "marketplace"."AutoListing"("status", "featuredUntil");
CREATE INDEX IF NOT EXISTS "AutoListing_status_boostUntil_idx" ON "marketplace"."AutoListing"("status", "boostUntil");
CREATE INDEX IF NOT EXISTS "AutoPublisher_verified_status_idx" ON "marketplace"."AutoPublisher"("verified", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "AutoMonetizationPurchase_paymentLedgerId_key" ON "marketplace"."AutoMonetizationPurchase"("paymentLedgerId");
CREATE INDEX IF NOT EXISTS "AutoMonetizationPurchase_status_kind_idx" ON "marketplace"."AutoMonetizationPurchase"("status", "kind");
CREATE INDEX IF NOT EXISTS "AutoMonetizationPurchase_listingId_createdAt_idx" ON "marketplace"."AutoMonetizationPurchase"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "AutoMonetizationPurchase_publisherId_createdAt_idx" ON "marketplace"."AutoMonetizationPurchase"("publisherId", "createdAt");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoMonetizationBalance"
    ADD CONSTRAINT "AutoMonetizationBalance_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."AutoPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoMonetizationPurchase"
    ADD CONSTRAINT "AutoMonetizationPurchase_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "marketplace"."AutoListing"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoMonetizationPurchase"
    ADD CONSTRAINT "AutoMonetizationPurchase_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."AutoPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoMonetizationPurchase"
    ADD CONSTRAINT "AutoMonetizationPurchase_paymentLedgerId_fkey"
    FOREIGN KEY ("paymentLedgerId") REFERENCES "marketplace"."PaymentLedger"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoMonetizationPurchase"
    ADD CONSTRAINT "AutoMonetizationPurchase_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;