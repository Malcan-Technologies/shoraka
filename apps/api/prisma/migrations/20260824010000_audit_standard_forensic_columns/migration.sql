-- Additive only: every column is nullable, no column or table is dropped, renamed or backfilled.
--
-- Indexes are limited to the two new forensic access paths: (target_type, target_id, created_at)
-- for "what happened to this object", and (correlation_id) for "everything in this request".
-- Composite indexes over already-indexed legacy columns are deliberately omitted: they would tune
-- existing reader queries rather than serve the new columns, and each build takes ACCESS EXCLUSIVE
-- on a table whose writes sit inside business transactions.

-- AlterTable
ALTER TABLE "access_logs" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "security_logs" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "onboarding_logs" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "actor_user_id" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "organization_kind" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "application_review_events" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "note_events" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "note_admin_actions" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "gateway_payment_events" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "legal_document_audit_logs" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "product_logs" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- AlterTable
ALTER TABLE "application_logs" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- notification_logs is owned by origin/main's delivery-history migration
-- (source enum ADMIN/SYSTEM, delivered_* counts, idempotency_key). Do not add
-- the older forensic columns here.

-- CreateIndex
CREATE INDEX "access_logs_target_type_target_id_created_at_idx" ON "access_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "access_logs_correlation_id_idx" ON "access_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "security_logs_target_type_target_id_created_at_idx" ON "security_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "security_logs_correlation_id_idx" ON "security_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "onboarding_logs_actor_user_id_created_at_idx" ON "onboarding_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "onboarding_logs_target_type_target_id_created_at_idx" ON "onboarding_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "onboarding_logs_correlation_id_idx" ON "onboarding_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "application_review_events_correlation_id_idx" ON "application_review_events"("correlation_id");

-- CreateIndex
CREATE INDEX "note_events_target_type_target_id_created_at_idx" ON "note_events"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "note_events_correlation_id_idx" ON "note_events"("correlation_id");

-- CreateIndex
CREATE INDEX "note_admin_actions_target_type_target_id_created_at_idx" ON "note_admin_actions"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "note_admin_actions_correlation_id_idx" ON "note_admin_actions"("correlation_id");

-- CreateIndex
CREATE INDEX "gateway_payment_events_target_type_target_id_created_at_idx" ON "gateway_payment_events"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "gateway_payment_events_correlation_id_idx" ON "gateway_payment_events"("correlation_id");

-- CreateIndex
CREATE INDEX "legal_document_audit_logs_target_type_target_id_created_at_idx" ON "legal_document_audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "legal_document_audit_logs_correlation_id_idx" ON "legal_document_audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "product_logs_target_type_target_id_created_at_idx" ON "product_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "product_logs_correlation_id_idx" ON "product_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "application_logs_target_type_target_id_created_at_idx" ON "application_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "application_logs_correlation_id_idx" ON "application_logs"("correlation_id");

