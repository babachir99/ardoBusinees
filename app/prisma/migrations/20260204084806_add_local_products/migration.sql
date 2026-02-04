-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'LOCAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryOptions" TEXT,
ADD COLUMN     "pickupLocation" TEXT,
ADD COLUMN     "stockQuantity" INTEGER DEFAULT 0;
