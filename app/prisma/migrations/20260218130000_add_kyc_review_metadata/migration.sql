-- AlterTable
ALTER TABLE "KycSubmission"
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewReason" TEXT;

-- CreateIndex
CREATE INDEX "KycSubmission_reviewedById_idx" ON "KycSubmission"("reviewedById");

-- AddForeignKey
ALTER TABLE "KycSubmission"
ADD CONSTRAINT "KycSubmission_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
