-- CreateEnum
CREATE TYPE "BoostStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "boostRequestedAt" TIMESTAMP(3),
ADD COLUMN     "boostStatus" "BoostStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "boostedUntil" TIMESTAMP(3),
ADD COLUMN     "discountPercent" INTEGER;
