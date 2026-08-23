-- Phase 2 legal-admin audit. No FKs: legal_document_id, legal_document_version_id,
-- and actor_user_id are historical scalars so rows survive target/user deletion.
-- Legacy legal_document_audit_logs is unchanged and unused by live writers/readers.

CREATE TABLE "legal_admin_audit_logs" (
  "id" TEXT NOT NULL,
  "legal_document_id" TEXT NOT NULL,
  "legal_document_version_id" TEXT,
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

  CONSTRAINT "legal_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_admin_audit_logs_legal_document_id_occurred_at_idx" ON "legal_admin_audit_logs"("legal_document_id", "occurred_at");
CREATE INDEX "legal_admin_audit_logs_event_type_occurred_at_idx" ON "legal_admin_audit_logs"("event_type", "occurred_at");
CREATE INDEX "legal_admin_audit_logs_actor_user_id_occurred_at_idx" ON "legal_admin_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "legal_admin_audit_logs_target_type_target_id_occurred_at_idx" ON "legal_admin_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "legal_admin_audit_logs_correlation_id_idx" ON "legal_admin_audit_logs"("correlation_id");
