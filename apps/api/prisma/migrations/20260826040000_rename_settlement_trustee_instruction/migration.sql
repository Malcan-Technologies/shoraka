-- Canonical rename: settlement-wide trustee instruction is not service-fee-only.
-- Dev/UAT data is disposable; this migration renames types/columns in place.

ALTER TYPE "ServiceFeeTrusteeInstructionStatus" RENAME TO "SettlementTrusteeInstructionStatus";

ALTER TABLE "note_settlements" RENAME COLUMN "service_fee_trustee_status" TO "settlement_trustee_status";
ALTER TABLE "note_settlements" RENAME COLUMN "service_fee_trustee_created_at" TO "settlement_trustee_created_at";
ALTER TABLE "note_settlements" RENAME COLUMN "service_fee_trustee_letter_generated_at" TO "settlement_trustee_letter_generated_at";
ALTER TABLE "note_settlements" RENAME COLUMN "service_fee_trustee_submitted_at" TO "settlement_trustee_submitted_at";
ALTER TABLE "note_settlements" RENAME COLUMN "service_fee_trustee_completed_at" TO "settlement_trustee_completed_at";
ALTER TABLE "note_settlements" RENAME COLUMN "service_fee_trustee_email_sent_at" TO "settlement_trustee_email_sent_at";

ALTER INDEX "note_settlements_service_fee_trustee_status_idx" RENAME TO "note_settlements_settlement_trustee_status_idx";

UPDATE "admin_roles"
SET permissions = array_replace(permissions, 'service_fee.view', 'settlements.view')
WHERE 'service_fee.view' = ANY (permissions);
