-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'HOLD';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeStatus') THEN
    CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Dispute" (
    "id" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dispute_openedById_status_createdAt_idx" ON "Dispute"("openedById", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dispute_referenceId_idx" ON "Dispute"("referenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dispute_vertical_status_idx" ON "Dispute"("vertical", "status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Dispute_openedById_fkey'
  ) THEN
    ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey"
      FOREIGN KEY ("openedById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
