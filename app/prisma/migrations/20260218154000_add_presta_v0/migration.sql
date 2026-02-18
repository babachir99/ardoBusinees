-- CreateEnum
CREATE TYPE "PrestaBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'COMPLETED', 'CANCELED', 'REJECTED');

-- CreateTable
CREATE TABLE "PrestaService" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "storeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "city" TEXT,
    "basePriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "contactPhone" TEXT,
    "acceptedPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrestaService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrestaBooking" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "PrestaBookingStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "paymentMethod" "PaymentMethod",
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrestaBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrestaService_providerId_idx" ON "PrestaService"("providerId");

-- CreateIndex
CREATE INDEX "PrestaService_storeId_idx" ON "PrestaService"("storeId");

-- CreateIndex
CREATE INDEX "PrestaService_isActive_createdAt_idx" ON "PrestaService"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrestaBooking_orderId_key" ON "PrestaBooking"("orderId");

-- CreateIndex
CREATE INDEX "PrestaBooking_serviceId_status_createdAt_idx" ON "PrestaBooking"("serviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PrestaBooking_customerId_status_createdAt_idx" ON "PrestaBooking"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PrestaBooking_providerId_status_createdAt_idx" ON "PrestaBooking"("providerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PrestaBooking_orderId_idx" ON "PrestaBooking"("orderId");

-- AddForeignKey
ALTER TABLE "PrestaService" ADD CONSTRAINT "PrestaService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestaService" ADD CONSTRAINT "PrestaService_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestaBooking" ADD CONSTRAINT "PrestaBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "PrestaService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestaBooking" ADD CONSTRAINT "PrestaBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestaBooking" ADD CONSTRAINT "PrestaBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
