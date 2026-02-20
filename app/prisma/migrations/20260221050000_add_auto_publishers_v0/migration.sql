-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoPublisherType" AS ENUM ('INDIVIDUAL', 'DEALER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoPublisherMemberRole" AS ENUM ('OWNER', 'AGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "marketplace"."AutoPublisherStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketplace"."AutoPublisher" (
    "id" TEXT NOT NULL,
    "type" "marketplace"."AutoPublisherType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "marketplace"."AutoPublisherStatus" NOT NULL DEFAULT 'ACTIVE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "city" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoPublisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketplace"."AutoPublisherMember" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "marketplace"."AutoPublisherMemberRole" NOT NULL DEFAULT 'AGENT',
    "status" "marketplace"."UserRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoPublisherMember_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "marketplace"."AutoListing" ADD COLUMN IF NOT EXISTS "publisherId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AutoPublisher_slug_key" ON "marketplace"."AutoPublisher"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoPublisher_status_type_createdAt_idx" ON "marketplace"."AutoPublisher"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoPublisher_status_country_city_idx" ON "marketplace"."AutoPublisher"("status", "country", "city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoPublisher_verified_status_idx" ON "marketplace"."AutoPublisher"("verified", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AutoPublisherMember_publisherId_userId_key" ON "marketplace"."AutoPublisherMember"("publisherId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoPublisherMember_publisherId_status_idx" ON "marketplace"."AutoPublisherMember"("publisherId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoPublisherMember_userId_status_idx" ON "marketplace"."AutoPublisherMember"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutoListing_publisherId_status_idx" ON "marketplace"."AutoListing"("publisherId", "status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoListing"
    ADD CONSTRAINT "AutoListing_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."AutoPublisher"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoPublisherMember"
    ADD CONSTRAINT "AutoPublisherMember_publisherId_fkey"
    FOREIGN KEY ("publisherId") REFERENCES "marketplace"."AutoPublisher"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketplace"."AutoPublisherMember"
    ADD CONSTRAINT "AutoPublisherMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
