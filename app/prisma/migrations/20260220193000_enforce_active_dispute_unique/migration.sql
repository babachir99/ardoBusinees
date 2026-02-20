CREATE UNIQUE INDEX IF NOT EXISTS "Dispute_active_context_unique" ON "marketplace"."Dispute"("contextType", "contextId") WHERE "status" IN ('OPEN', 'IN_REVIEW');
