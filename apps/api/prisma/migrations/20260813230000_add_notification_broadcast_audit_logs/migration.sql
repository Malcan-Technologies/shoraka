-- Phase 3 notification broadcast audit. No FKs: actor_user_id and
-- notification_type_id are historical scalars so rows survive User and
-- NotificationType deletion. Inbox cleanup must not delete this table.

CREATE TABLE "notification_broadcast_audit_logs" (
  "id" TEXT NOT NULL,
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
  "audience_type" TEXT NOT NULL,
  "notification_type_id" TEXT NOT NULL,

  CONSTRAINT "notification_broadcast_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_broadcast_audit_logs_occurred_at_idx" ON "notification_broadcast_audit_logs"("occurred_at");
CREATE INDEX "notification_broadcast_audit_logs_event_type_occurred_at_idx" ON "notification_broadcast_audit_logs"("event_type", "occurred_at");
CREATE INDEX "notification_broadcast_audit_logs_actor_user_id_occurred_at_idx" ON "notification_broadcast_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "notification_broadcast_audit_logs_target_type_target_id_occurred_at_idx" ON "notification_broadcast_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "notification_broadcast_audit_logs_correlation_id_idx" ON "notification_broadcast_audit_logs"("correlation_id");
CREATE INDEX "notification_broadcast_audit_logs_audience_type_occurred_at_idx" ON "notification_broadcast_audit_logs"("audience_type", "occurred_at");
CREATE INDEX "notification_broadcast_audit_logs_notification_type_id_occurred_at_idx" ON "notification_broadcast_audit_logs"("notification_type_id", "occurred_at");
