-- Inline guarantor AML state on application_guarantors; remove global guarantors registry.
-- Existing link rows are cleared (no backfill from registry); issuer business_details remains source to re-sync rows.
BEGIN;

DELETE FROM "application_guarantors";

ALTER TABLE "application_guarantors" DROP CONSTRAINT IF EXISTS "application_guarantors_guarantor_id_fkey";

DROP INDEX IF EXISTS "application_guarantors_guarantor_id_idx";
DROP INDEX IF EXISTS "application_guarantors_application_id_guarantor_id_key";

ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "guarantor_id";

DROP TABLE IF EXISTS "guarantors";

ALTER TABLE "application_guarantors" ADD COLUMN "client_guarantor_id" TEXT NOT NULL;
ALTER TABLE "application_guarantors" ADD COLUMN "guarantor_type" "GuarantorType" NOT NULL;
ALTER TABLE "application_guarantors" ADD COLUMN "email" TEXT NOT NULL;
ALTER TABLE "application_guarantors" ADD COLUMN "first_name" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "last_name" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "company_name" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "ic_number" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "ssm_number" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "aml_status" "GuarantorAmlStatus" NOT NULL DEFAULT 'Pending';
ALTER TABLE "application_guarantors" ADD COLUMN "aml_message_status" "GuarantorAmlMessage" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "application_guarantors" ADD COLUMN "aml_risk_score" DOUBLE PRECISION;
ALTER TABLE "application_guarantors" ADD COLUMN "aml_risk_level" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN "last_triggered_at" TIMESTAMP(3);
ALTER TABLE "application_guarantors" ADD COLUMN "last_synced_at" TIMESTAMP(3);
ALTER TABLE "application_guarantors" ADD COLUMN "triggered_by_admin_user_id" VARCHAR(5);
ALTER TABLE "application_guarantors" ADD COLUMN "metadata" JSONB;

CREATE UNIQUE INDEX "application_guarantors_application_id_client_guarantor_id_key" ON "application_guarantors"("application_id", "client_guarantor_id");

ALTER TABLE "application_guarantors" ADD CONSTRAINT "application_guarantors_triggered_by_admin_user_id_fkey" FOREIGN KEY ("triggered_by_admin_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "application_guarantors_email_idx" ON "application_guarantors"("email");

COMMIT;
