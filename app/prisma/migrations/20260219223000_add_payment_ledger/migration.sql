-- CreateEnum
CREATE TYPE "marketplace"."PaymentLedgerContextType" AS ENUM ('SHOP_ORDER', 'PRESTA_BOOKING', 'TIAK_DELIVERY');

-- CreateEnum
CREATE TYPE "marketplace"."PaymentLedgerStatus" AS ENUM ('INITIATED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "marketplace"."PaymentLedger" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL DEFAULT 'PAYDUNYA',
    "providerIntentId" TEXT,
    "orderId" TEXT,
    "contextType" "marketplace"."PaymentLedgerContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "amountTotalCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "payoutCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "marketplace"."PaymentLedgerStatus" NOT NULL DEFAULT 'INITIATED',

    CONSTRAINT "PaymentLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedger_providerIntentId_key" ON "marketplace"."PaymentLedger"("providerIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedger_contextType_contextId_key" ON "marketplace"."PaymentLedger"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "PaymentLedger_orderId_idx" ON "marketplace"."PaymentLedger"("orderId");

-- AddForeignKey
ALTER TABLE "marketplace"."PaymentLedger" ADD CONSTRAINT "PaymentLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;