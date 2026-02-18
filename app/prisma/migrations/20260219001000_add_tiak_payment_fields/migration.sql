-- AlterTable
ALTER TABLE "TiakDelivery"
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
