-- Append-only note lifecycle history. No FKs so rows survive Note/User/org deletion.
-- note_id is nullable only for TRUSTEE_SIGNATURE_UPDATED (global trustee-document config).
CREATE TABLE "note_audit_logs" (
    "id" TEXT NOT NULL,
    "note_id" TEXT,
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

    CONSTRAINT "note_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "note_audit_logs_note_id_occurred_at_idx" ON "note_audit_logs"("note_id", "occurred_at");
CREATE INDEX "note_audit_logs_event_type_occurred_at_idx" ON "note_audit_logs"("event_type", "occurred_at");
CREATE INDEX "note_audit_logs_organization_id_occurred_at_idx" ON "note_audit_logs"("organization_id", "occurred_at");
CREATE INDEX "note_audit_logs_actor_user_id_occurred_at_idx" ON "note_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "note_audit_logs_target_type_target_id_occurred_at_idx" ON "note_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "note_audit_logs_correlation_id_idx" ON "note_audit_logs"("correlation_id");
