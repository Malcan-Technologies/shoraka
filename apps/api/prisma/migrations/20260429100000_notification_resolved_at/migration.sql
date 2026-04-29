-- Director/shareholder (Option A): resolve notifications without deleting history
ALTER TABLE "notifications" ADD COLUMN "resolved_at" TIMESTAMP(3);
CREATE INDEX "notifications_resolved_at_idx" ON "notifications"("resolved_at");
