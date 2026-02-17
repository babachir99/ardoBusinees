ALTER TABLE "User"
ADD COLUMN "transporterRating" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN "transporterReviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TransporterReview" (
    "id" TEXT NOT NULL,
    "transporterId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransporterReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransporterReview_tripId_reviewerId_key" ON "TransporterReview"("tripId", "reviewerId");
CREATE INDEX "TransporterReview_transporterId_createdAt_idx" ON "TransporterReview"("transporterId", "createdAt");
CREATE INDEX "TransporterReview_reviewerId_createdAt_idx" ON "TransporterReview"("reviewerId", "createdAt");
CREATE INDEX "TransporterReview_tripId_createdAt_idx" ON "TransporterReview"("tripId", "createdAt");

ALTER TABLE "TransporterReview" ADD CONSTRAINT "TransporterReview_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransporterReview" ADD CONSTRAINT "TransporterReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransporterReview" ADD CONSTRAINT "TransporterReview_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "GpTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
