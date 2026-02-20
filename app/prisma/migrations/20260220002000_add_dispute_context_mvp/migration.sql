DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeContextType') THEN
    CREATE TYPE "DisputeContextType" AS ENUM ('SHOP_ORDER', 'PRESTA_BOOKING', 'TIAK_DELIVERY', 'GP_SHIPMENT');
  END IF;
END
$$;

ALTER TABLE "Dispute"
  ADD COLUMN IF NOT EXISTS "contextType" "DisputeContextType" NOT NULL DEFAULT 'SHOP_ORDER',
  ADD COLUMN IF NOT EXISTS "contextId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;

UPDATE "Dispute"
SET
  "contextType" = CASE
    WHEN UPPER(COALESCE("vertical", '')) = 'PRESTA' THEN 'PRESTA_BOOKING'::"DisputeContextType"
    WHEN UPPER(COALESCE("vertical", '')) = 'TIAK_TIAK' THEN 'TIAK_DELIVERY'::"DisputeContextType"
    WHEN UPPER(COALESCE("vertical", '')) = 'GP' THEN 'GP_SHIPMENT'::"DisputeContextType"
    ELSE 'SHOP_ORDER'::"DisputeContextType"
  END,
  "contextId" = CASE
    WHEN COALESCE(NULLIF("contextId", ''), '') <> '' THEN "contextId"
    ELSE COALESCE("referenceId", '')
  END
WHERE "contextId" = '';

CREATE INDEX IF NOT EXISTS "Dispute_assignedAdminId_idx" ON "Dispute"("assignedAdminId");
CREATE INDEX IF NOT EXISTS "Dispute_contextType_contextId_idx" ON "Dispute"("contextType", "contextId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Dispute_assignedAdminId_fkey'
  ) THEN
    ALTER TABLE "Dispute"
      ADD CONSTRAINT "Dispute_assignedAdminId_fkey"
      FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = ANY (current_schemas(false))
      AND indexname = 'Dispute_contextType_contextId_status_key'
  ) THEN
    CREATE UNIQUE INDEX "Dispute_contextType_contextId_status_key"
      ON "Dispute"("contextType", "contextId", "status");
  END IF;
END
$$;