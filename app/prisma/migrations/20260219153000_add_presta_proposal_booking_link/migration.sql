-- AlterTable
ALTER TABLE "marketplace"."PrestaBooking"
  ADD COLUMN "proposalId" TEXT;

ALTER TABLE "marketplace"."PrestaProposal"
  ADD COLUMN "bookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PrestaBooking_proposalId_key" ON "marketplace"."PrestaBooking"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "PrestaProposal_bookingId_key" ON "marketplace"."PrestaProposal"("bookingId");

-- AddForeignKey
ALTER TABLE "marketplace"."PrestaBooking"
  ADD CONSTRAINT "PrestaBooking_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "marketplace"."PrestaProposal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."PrestaProposal"
  ADD CONSTRAINT "PrestaProposal_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "marketplace"."PrestaBooking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
