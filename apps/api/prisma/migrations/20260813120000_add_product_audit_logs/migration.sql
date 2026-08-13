-- Phase 1 Product lifecycle audit. No FKs: product_id and actor_user_id are
-- historical scalars so rows survive Product hard-delete and User deletion.

CREATE TABLE "product_audit_logs" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_type" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "organization_id" TEXT,
  "organization_kind" TEXT,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "portal" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "correlation_id" TEXT,
  "idempotency_key" TEXT,
  "metadata" JSONB NOT NULL,

  CONSTRAINT "product_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_audit_logs_product_id_occurred_at_idx" ON "product_audit_logs"("product_id", "occurred_at");
CREATE INDEX "product_audit_logs_event_type_occurred_at_idx" ON "product_audit_logs"("event_type", "occurred_at");
CREATE INDEX "product_audit_logs_actor_user_id_occurred_at_idx" ON "product_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "product_audit_logs_target_type_target_id_occurred_at_idx" ON "product_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "product_audit_logs_correlation_id_idx" ON "product_audit_logs"("correlation_id");
