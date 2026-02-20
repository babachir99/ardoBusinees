ALTER TABLE "marketplace"."ImmoListing"
  ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
