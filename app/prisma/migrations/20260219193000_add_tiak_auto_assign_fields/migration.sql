-- AlterTable
ALTER TABLE "marketplace"."TiakDelivery"
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "assignExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TiakDelivery_assignExpiresAt_idx" ON "marketplace"."TiakDelivery"("assignExpiresAt");
