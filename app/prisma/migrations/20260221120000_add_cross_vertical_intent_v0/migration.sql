DO $$ BEGIN
  CREATE TYPE "marketplace"."CrossVerticalSourceVertical" AS ENUM ('CARS', 'SHOP', 'IMMO', 'PRESTA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CrossVerticalIntentType" AS ENUM ('TRANSPORT', 'LOCAL_DELIVERY', 'SERVICE_REQUEST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CrossVerticalObjectType" AS ENUM ('DOCUMENTS', 'SMALL_PARCEL', 'PARTS', 'KEYS', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."CrossVerticalIntentStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "marketplace"."CrossVerticalIntent" (
  "id" TEXT NOT NULL,
  "sourceVertical" "marketplace"."CrossVerticalSourceVertical" NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "intentType" "marketplace"."CrossVerticalIntentType" NOT NULL,
  "objectType" "marketplace"."CrossVerticalObjectType" NOT NULL DEFAULT 'NONE',
  "weightKg" DOUBLE PRECISION,
  "fromCountry" TEXT,
  "toCountry" TEXT,
  "fromCity" TEXT,
  "toCity" TEXT,
  "status" "marketplace"."CrossVerticalIntentStatus" NOT NULL DEFAULT 'OPEN',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrossVerticalIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrossVerticalIntent_createdByUserId_createdAt_idx" ON "marketplace"."CrossVerticalIntent"("createdByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrossVerticalIntent_status_createdAt_idx" ON "marketplace"."CrossVerticalIntent"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrossVerticalIntent_sourceVertical_sourceEntityId_idx" ON "marketplace"."CrossVerticalIntent"("sourceVertical", "sourceEntityId");

DO $$ BEGIN
  ALTER TABLE "marketplace"."CrossVerticalIntent"
    ADD CONSTRAINT "CrossVerticalIntent_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
