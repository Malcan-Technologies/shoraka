-- Durable amendment-remark SOT: remarks are scoped by review_cycle so submitted
-- remarks survive issuer resubmit. ApplicationAuditLog is append-only history.
-- Legacy application_logs remains until SigningAuditLog cutover (SIGNING_PACKAGE_*).

ALTER TABLE "application_review_remarks" ADD COLUMN "review_cycle" INTEGER NOT NULL DEFAULT 1;

UPDATE "application_review_remarks" AS r
SET "review_cycle" = a."review_cycle"
FROM "applications" AS a
WHERE r."application_id" = a."id";

-- Prisma @@unique is a UNIQUE CONSTRAINT, not a standalone index.
-- DROP INDEX fails with 2BP01; drop the constraint (index follows).
ALTER TABLE "application_review_remarks" DROP CONSTRAINT IF EXISTS "application_review_remarks_application_id_scope_scope_key_key";
DROP INDEX IF EXISTS "application_review_remarks_application_id_scope_scope_key_key";

CREATE UNIQUE INDEX "application_review_remarks_app_cycle_scope_key" ON "application_review_remarks"("application_id", "review_cycle", "scope", "scope_key");

CREATE INDEX "application_review_remarks_application_id_review_cycle_idx" ON "application_review_remarks"("application_id", "review_cycle");

CREATE TABLE "application_audit_logs" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
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

    CONSTRAINT "application_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_audit_logs_occurred_at_idx" ON "application_audit_logs"("occurred_at");
CREATE INDEX "application_audit_logs_event_type_occurred_at_idx" ON "application_audit_logs"("event_type", "occurred_at");
CREATE INDEX "application_audit_logs_application_id_occurred_at_idx" ON "application_audit_logs"("application_id", "occurred_at");
CREATE INDEX "application_audit_logs_organization_id_occurred_at_idx" ON "application_audit_logs"("organization_id", "occurred_at");
CREATE INDEX "application_audit_logs_actor_user_id_occurred_at_idx" ON "application_audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "application_audit_logs_target_type_target_id_occurred_at_idx" ON "application_audit_logs"("target_type", "target_id", "occurred_at");
CREATE INDEX "application_audit_logs_correlation_id_idx" ON "application_audit_logs"("correlation_id");
