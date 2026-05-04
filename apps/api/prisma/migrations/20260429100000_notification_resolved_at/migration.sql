-- Director/shareholder (Option A): resolve notifications without deleting history
ALTER TABLE "notifications"
ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "notifications_resolved_at_idx"
ON "notifications"("resolved_at");
