CREATE TYPE "GpBookingStatus" AS ENUM ('DRAFT', 'PENDING', 'ACCEPTED', 'CONFIRMED', 'COMPLETED', 'DELIVERED', 'CANCELED', 'REJECTED');

CREATE TABLE "GpTripBooking" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transporterId" TEXT NOT NULL,
    "status" "GpBookingStatus" NOT NULL DEFAULT 'PENDING',
    "requestedKg" INTEGER NOT NULL,
    "packageCount" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpTripBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GpTripBooking_tripId_customerId_key" ON "GpTripBooking"("tripId", "customerId");
CREATE INDEX "GpTripBooking_customerId_status_createdAt_idx" ON "GpTripBooking"("customerId", "status", "createdAt");
CREATE INDEX "GpTripBooking_transporterId_status_createdAt_idx" ON "GpTripBooking"("transporterId", "status", "createdAt");
CREATE INDEX "GpTripBooking_tripId_status_createdAt_idx" ON "GpTripBooking"("tripId", "status", "createdAt");

ALTER TABLE "GpTripBooking" ADD CONSTRAINT "GpTripBooking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "GpTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GpTripBooking" ADD CONSTRAINT "GpTripBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GpTripBooking" ADD CONSTRAINT "GpTripBooking_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
