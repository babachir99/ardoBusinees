-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerEmail" TEXT,
ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "buyerPhone" TEXT,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "shippingCity" TEXT;

-- CreateIndex
CREATE INDEX "Order_buyerEmail_idx" ON "Order"("buyerEmail");
