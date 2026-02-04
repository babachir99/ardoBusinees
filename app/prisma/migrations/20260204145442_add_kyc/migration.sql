-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycRole" AS ENUM ('SELLER', 'TRANSPORTER', 'COURIER');

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetRole" "KycRole" NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "docIdUrl" TEXT,
    "driverLicenseUrl" TEXT,
    "proofAddressUrl" TEXT,
    "selfieUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycSubmission_userId_idx" ON "KycSubmission"("userId");

-- CreateIndex
CREATE INDEX "KycSubmission_status_idx" ON "KycSubmission"("status");

-- CreateIndex
CREATE INDEX "KycSubmission_targetRole_idx" ON "KycSubmission"("targetRole");

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
