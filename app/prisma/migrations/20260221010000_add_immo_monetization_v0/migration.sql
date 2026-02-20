-- Extend PaymentLedger context enum
DO $$ BEGIN
  ALTER TYPE "marketplace"."PaymentLedgerContextType" ADD VALUE IF NOT EXISTS 'IMMO_MONETIZATION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."ImmoMonetizationKind" AS ENUM ('FEATURED', 'BOOST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."ImmoMonetizationPurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "marketplace"."ImmoListing"
  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featuredUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "boostUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "monetizationUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketplace"."ImmoMonetizationPurchase" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "kind" "marketplace"."ImmoMonetizationKind" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "marketplace"."ImmoMonetizationPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paymentLedgerId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImmoMonetizationPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ImmoMonetizationPurchase_paymentLedgerId_key" ON "marketplace"."ImmoMonetizationPurchase"("paymentLedgerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_status_featuredUntil_idx" ON "marketplace"."ImmoListing"("status", "featuredUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoListing_status_boostUntil_idx" ON "marketplace"."ImmoListing"("status", "boostUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoMonetizationPurchase_status_kind_idx" ON "marketplace"."ImmoMonetizationPurchase"("status", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoMonetizationPurchase_listingId_createdAt_idx" ON "marketplace"."ImmoMonetizationPurchase"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImmoMonetizationPurchase_publisherId_createdAt_idx" ON "marketplace"."ImmoMonetizationPurchase"("publisherId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
    ADD CONSTRAINT "ImmoMonetizationPurchase_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "marketplace"."ImmoListing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
    ADD CONSTRAINT "ImmoMonetizationPurchase_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."ImmoPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
    ADD CONSTRAINT "ImmoMonetizationPurchase_paymentLedgerId_fkey"
    FOREIGN KEY ("paymentLedgerId") REFERENCES "marketplace"."PaymentLedger"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."ImmoMonetizationPurchase"
    ADD CONSTRAINT "ImmoMonetizationPurchase_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
