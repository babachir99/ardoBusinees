CREATE TYPE "GpTripStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELED');

CREATE TABLE "GpTrip" (
    "id" TEXT NOT NULL,
    "transporterId" TEXT NOT NULL,
    "storeId" TEXT,
    "originCity" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "destinationCity" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "flightDate" TIMESTAMP(3) NOT NULL,
    "deliveryStartAt" TIMESTAMP(3),
    "deliveryEndAt" TIMESTAMP(3),
    "availableKg" INTEGER NOT NULL,
    "pricePerKgCents" INTEGER NOT NULL,
    "maxPackages" INTEGER,
    "acceptedPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[] NOT NULL,
    "contactPhone" TEXT,
    "notes" TEXT,
    "status" "GpTripStatus" NOT NULL DEFAULT 'OPEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpTrip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GpTrip_transporterId_idx" ON "GpTrip"("transporterId");
CREATE INDEX "GpTrip_storeId_idx" ON "GpTrip"("storeId");
CREATE INDEX "GpTrip_status_idx" ON "GpTrip"("status");
CREATE INDEX "GpTrip_flightDate_idx" ON "GpTrip"("flightDate");

ALTER TABLE "GpTrip"
ADD CONSTRAINT "GpTrip_transporterId_fkey"
FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GpTrip"
ADD CONSTRAINT "GpTrip_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
