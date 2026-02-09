-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED', 'EXPIRED');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "optionColor" TEXT,
ADD COLUMN     "optionSize" TEXT;

-- CreateTable
CREATE TABLE "ProductInquiry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInquiryMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductInquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOffer" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "note" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductInquiry_sellerId_status_lastMessageAt_idx" ON "ProductInquiry"("sellerId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ProductInquiry_buyerId_status_lastMessageAt_idx" ON "ProductInquiry"("buyerId", "status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInquiry_productId_buyerId_key" ON "ProductInquiry"("productId", "buyerId");

-- CreateIndex
CREATE INDEX "ProductInquiryMessage_inquiryId_createdAt_idx" ON "ProductInquiryMessage"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductInquiryMessage_senderId_idx" ON "ProductInquiryMessage"("senderId");

-- CreateIndex
CREATE INDEX "ProductOffer_inquiryId_createdAt_idx" ON "ProductOffer"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOffer_sellerId_status_createdAt_idx" ON "ProductOffer"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOffer_buyerId_status_createdAt_idx" ON "ProductOffer"("buyerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductInquiry" ADD CONSTRAINT "ProductInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInquiry" ADD CONSTRAINT "ProductInquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInquiry" ADD CONSTRAINT "ProductInquiry_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInquiryMessage" ADD CONSTRAINT "ProductInquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "ProductInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInquiryMessage" ADD CONSTRAINT "ProductInquiryMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "ProductInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
