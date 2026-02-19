-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrestaProposalStatus') THEN
    CREATE TYPE "PrestaProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PrestaProposal" (
  "id" TEXT NOT NULL,
  "needId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "message" TEXT,
  "status" "PrestaProposalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrestaProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PrestaProposal_needId_providerId_key" ON "PrestaProposal"("needId", "providerId");
CREATE INDEX IF NOT EXISTS "PrestaProposal_needId_status_createdAt_idx" ON "PrestaProposal"("needId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PrestaProposal_serviceId_idx" ON "PrestaProposal"("serviceId");
CREATE INDEX IF NOT EXISTS "PrestaProposal_providerId_createdAt_idx" ON "PrestaProposal"("providerId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestaProposal_needId_fkey') THEN
    ALTER TABLE "PrestaProposal"
      ADD CONSTRAINT "PrestaProposal_needId_fkey"
      FOREIGN KEY ("needId") REFERENCES "PrestaNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestaProposal_serviceId_fkey') THEN
    ALTER TABLE "PrestaProposal"
      ADD CONSTRAINT "PrestaProposal_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "PrestaService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestaProposal_providerId_fkey') THEN
    ALTER TABLE "PrestaProposal"
      ADD CONSTRAINT "PrestaProposal_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
