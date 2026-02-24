DO $$ BEGIN
  CREATE TYPE "marketplace"."CrossVerticalTargetVertical" AS ENUM ('GP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "marketplace"."CrossVerticalIntent"
  ADD COLUMN IF NOT EXISTS "targetVertical" "marketplace"."CrossVerticalTargetVertical",
  ADD COLUMN IF NOT EXISTS "targetEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CrossVerticalIntent_targetVertical_targetEntityId_idx"
  ON "marketplace"."CrossVerticalIntent"("targetVertical", "targetEntityId");
