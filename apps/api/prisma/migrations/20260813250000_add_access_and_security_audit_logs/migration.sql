-- Phase 4 access + security audit. No FKs: user_id / actor_user_id /
-- subject_user_id are historical scalars so rows survive User deletion
-- and public-id rewrites.

CREATE TABLE "access_audit_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
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

  CONSTRAINT "access_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_audit_logs_occurred_at_idx" ON "access_audit_logs"("occurred_at");
CREATE INDEX "access_audit_logs_event_type_occurred_at_idx" ON "access_audit_logs"("event_type", "occurred_at");
CREATE INDEX "access_audit_logs_user_id_occurred_at_idx" ON "access_audit_logs"("user_id", "occurred_at");
CREATE INDEX "access_audit_logs_actor_user_id_occurred_at_idx" ON "access_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "access_audit_logs_correlation_id_idx" ON "access_audit_logs"("correlation_id");

CREATE TABLE "security_audit_logs" (
  "id" TEXT NOT NULL,
  "subject_user_id" TEXT,
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

  CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_audit_logs_occurred_at_idx" ON "security_audit_logs"("occurred_at");
CREATE INDEX "security_audit_logs_event_type_occurred_at_idx" ON "security_audit_logs"("event_type", "occurred_at");
CREATE INDEX "security_audit_logs_subject_user_id_occurred_at_idx" ON "security_audit_logs"("subject_user_id", "occurred_at");
CREATE INDEX "security_audit_logs_actor_user_id_occurred_at_idx" ON "security_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "security_audit_logs_target_type_target_id_occurred_at_idx" ON "security_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "security_audit_logs_correlation_id_idx" ON "security_audit_logs"("correlation_id");
