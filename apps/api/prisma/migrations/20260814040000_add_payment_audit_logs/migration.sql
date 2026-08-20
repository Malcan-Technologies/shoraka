-- Append-only payment/cash-movement history. No FKs so rows survive
-- GatewayPayment/User/org deletion. gateway_payment_id is null for
-- withdrawal and reconciliation-only events.
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "gateway_payment_id" TEXT,
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

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_audit_logs_idempotency_key_key" ON "payment_audit_logs"("idempotency_key");
CREATE INDEX "payment_audit_logs_gateway_payment_id_occurred_at_idx" ON "payment_audit_logs"("gateway_payment_id", "occurred_at");
CREATE INDEX "payment_audit_logs_event_type_occurred_at_idx" ON "payment_audit_logs"("event_type", "occurred_at");
CREATE INDEX "payment_audit_logs_organization_id_occurred_at_idx" ON "payment_audit_logs"("organization_id", "occurred_at");
CREATE INDEX "payment_audit_logs_actor_user_id_occurred_at_idx" ON "payment_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "payment_audit_logs_target_type_target_id_occurred_at_idx" ON "payment_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "payment_audit_logs_correlation_id_idx" ON "payment_audit_logs"("correlation_id");
