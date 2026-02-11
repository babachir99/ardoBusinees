-- CreateTable
CREATE TABLE "UserCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "offerId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "optionColor" TEXT,
    "optionSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCart_userId_key" ON "UserCart"("userId");

-- CreateIndex
CREATE INDEX "UserCart_updatedAt_idx" ON "UserCart"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCartItem_cartId_lineId_key" ON "UserCartItem"("cartId", "lineId");

-- CreateIndex
CREATE INDEX "UserCartItem_cartId_idx" ON "UserCartItem"("cartId");

-- CreateIndex
CREATE INDEX "UserCartItem_productId_idx" ON "UserCartItem"("productId");

-- CreateIndex
CREATE INDEX "UserCartItem_offerId_idx" ON "UserCartItem"("offerId");

-- AddForeignKey
ALTER TABLE "UserCart" ADD CONSTRAINT "UserCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCartItem" ADD CONSTRAINT "UserCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "UserCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCartItem" ADD CONSTRAINT "UserCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCartItem" ADD CONSTRAINT "UserCartItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ProductOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
