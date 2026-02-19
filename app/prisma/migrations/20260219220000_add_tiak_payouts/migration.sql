-- CreateEnum
CREATE TYPE "marketplace"."TiakPayoutStatus" AS ENUM ('PENDING', 'READY', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "marketplace"."TiakPayout" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "amountTotalCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "courierPayoutCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "marketplace"."TiakPayoutStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TiakPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TiakPayout_deliveryId_key" ON "marketplace"."TiakPayout"("deliveryId");

-- CreateIndex
CREATE INDEX "TiakPayout_courierId_status_createdAt_idx" ON "marketplace"."TiakPayout"("courierId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "marketplace"."TiakPayout" ADD CONSTRAINT "TiakPayout_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "marketplace"."TiakDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."TiakPayout" ADD CONSTRAINT "TiakPayout_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "marketplace"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;