-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrestaNeedStatus') THEN
    CREATE TYPE "PrestaNeedStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACCEPTED', 'CLOSED', 'CANCELED');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PrestaNeed" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "storeId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "city" TEXT,
  "area" TEXT,
  "budgetCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "preferredDate" TIMESTAMP(3),
  "status" "PrestaNeedStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrestaNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TiakCourierProfile" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "vehicleType" TEXT,
  "maxWeightKg" INTEGER,
  "availableHours" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TiakCourierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PrestaNeed_status_createdAt_idx" ON "PrestaNeed"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PrestaNeed_customerId_createdAt_idx" ON "PrestaNeed"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "PrestaNeed_storeId_status_idx" ON "PrestaNeed"("storeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "TiakCourierProfile_courierId_key" ON "TiakCourierProfile"("courierId");
CREATE INDEX IF NOT EXISTS "TiakCourierProfile_isActive_updatedAt_idx" ON "TiakCourierProfile"("isActive", "updatedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestaNeed_customerId_fkey') THEN
    ALTER TABLE "PrestaNeed"
      ADD CONSTRAINT "PrestaNeed_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestaNeed_storeId_fkey') THEN
    ALTER TABLE "PrestaNeed"
      ADD CONSTRAINT "PrestaNeed_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TiakCourierProfile_courierId_fkey') THEN
    ALTER TABLE "TiakCourierProfile"
      ADD CONSTRAINT "TiakCourierProfile_courierId_fkey"
      FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
