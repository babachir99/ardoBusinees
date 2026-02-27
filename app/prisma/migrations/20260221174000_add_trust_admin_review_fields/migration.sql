-- Trust V0.2 moderation workflow fields (assignment + review metadata)

ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNote" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

ALTER TABLE "TrustDispute"
  ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNote" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Report_assignedAdminId_status_createdAt_idx"
  ON "Report"("assignedAdminId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "TrustDispute_assignedAdminId_status_createdAt_idx"
  ON "TrustDispute"("assignedAdminId", "status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Report"
    ADD CONSTRAINT "Report_assignedAdminId_fkey"
    FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrustDispute"
    ADD CONSTRAINT "TrustDispute_assignedAdminId_fkey"
    FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
