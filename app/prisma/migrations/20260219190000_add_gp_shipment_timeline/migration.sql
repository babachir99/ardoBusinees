-- CreateEnum
CREATE TYPE "marketplace"."GpShipmentStatus" AS ENUM ('DROPPED_OFF', 'PICKED_UP', 'BOARDED', 'ARRIVED', 'DELIVERED');

-- CreateTable
CREATE TABLE "marketplace"."GpShipment" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "tripId" TEXT,
  "senderId" TEXT,
  "receiverId" TEXT,
  "transporterId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "fromCity" TEXT NOT NULL,
  "toCity" TEXT NOT NULL,
  "weightKg" INTEGER NOT NULL,
  "status" "marketplace"."GpShipmentStatus" NOT NULL DEFAULT 'DROPPED_OFF',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GpShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."GpShipmentEvent" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "status" "marketplace"."GpShipmentStatus" NOT NULL,
  "note" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GpShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GpShipment_bookingId_key" ON "marketplace"."GpShipment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "GpShipment_code_key" ON "marketplace"."GpShipment"("code");

-- CreateIndex
CREATE INDEX "GpShipment_transporterId_status_updatedAt_idx" ON "marketplace"."GpShipment"("transporterId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GpShipment_senderId_status_updatedAt_idx" ON "marketplace"."GpShipment"("senderId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GpShipment_receiverId_status_updatedAt_idx" ON "marketplace"."GpShipment"("receiverId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GpShipment_tripId_status_idx" ON "marketplace"."GpShipment"("tripId", "status");

-- CreateIndex
CREATE INDEX "GpShipmentEvent_shipmentId_createdAt_idx" ON "marketplace"."GpShipmentEvent"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "GpShipmentEvent_actorId_createdAt_idx" ON "marketplace"."GpShipmentEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipment"
ADD CONSTRAINT "GpShipment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "marketplace"."GpTripBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipment"
ADD CONSTRAINT "GpShipment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "marketplace"."GpTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipment"
ADD CONSTRAINT "GpShipment_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "marketplace"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipment"
ADD CONSTRAINT "GpShipment_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "marketplace"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipment"
ADD CONSTRAINT "GpShipment_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipmentEvent"
ADD CONSTRAINT "GpShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "marketplace"."GpShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."GpShipmentEvent"
ADD CONSTRAINT "GpShipmentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
