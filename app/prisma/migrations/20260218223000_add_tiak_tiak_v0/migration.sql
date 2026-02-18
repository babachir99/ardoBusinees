-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TiakDeliveryStatus') THEN
    CREATE TYPE "TiakDeliveryStatus" AS ENUM (
      'REQUESTED',
      'ACCEPTED',
      'PICKED_UP',
      'DELIVERED',
      'COMPLETED',
      'CANCELED',
      'REJECTED'
    );
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TiakDelivery" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "courierId" TEXT,
  "status" "TiakDeliveryStatus" NOT NULL DEFAULT 'REQUESTED',
  "pickupAddress" TEXT NOT NULL,
  "dropoffAddress" TEXT NOT NULL,
  "note" TEXT,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "paymentMethod" "PaymentMethod",
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TiakDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TiakDeliveryEvent" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "status" "TiakDeliveryStatus" NOT NULL,
  "note" TEXT,
  "proofUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT NOT NULL,

  CONSTRAINT "TiakDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TiakDelivery_customerId_status_createdAt_idx" ON "TiakDelivery"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TiakDelivery_courierId_status_createdAt_idx" ON "TiakDelivery"("courierId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TiakDelivery_status_createdAt_idx" ON "TiakDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TiakDelivery_orderId_idx" ON "TiakDelivery"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TiakDeliveryEvent_deliveryId_createdAt_idx" ON "TiakDeliveryEvent"("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TiakDeliveryEvent_actorId_createdAt_idx" ON "TiakDeliveryEvent"("actorId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TiakDelivery_customerId_fkey'
  ) THEN
    ALTER TABLE "TiakDelivery"
      ADD CONSTRAINT "TiakDelivery_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TiakDelivery_courierId_fkey'
  ) THEN
    ALTER TABLE "TiakDelivery"
      ADD CONSTRAINT "TiakDelivery_courierId_fkey"
      FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TiakDelivery_orderId_fkey'
  ) THEN
    ALTER TABLE "TiakDelivery"
      ADD CONSTRAINT "TiakDelivery_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TiakDeliveryEvent_deliveryId_fkey'
  ) THEN
    ALTER TABLE "TiakDeliveryEvent"
      ADD CONSTRAINT "TiakDeliveryEvent_deliveryId_fkey"
      FOREIGN KEY ("deliveryId") REFERENCES "TiakDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TiakDeliveryEvent_actorId_fkey'
  ) THEN
    ALTER TABLE "TiakDeliveryEvent"
      ADD CONSTRAINT "TiakDeliveryEvent_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
