-- Rolling-deploy compatibility for 20260826040000_rename_settlement_trustee_instruction.
-- That migration renamed live columns/types the currently running API still queries.
-- Restore the physical names; application code keeps settlement_trustee_* via Prisma @map.
-- Also keep both RBAC keys so the old image can still authorize settlements.view checks
-- written as service_fee.view until the new API tasks are healthy.

ALTER TYPE "SettlementTrusteeInstructionStatus" RENAME TO "ServiceFeeTrusteeInstructionStatus";

ALTER TABLE "note_settlements" RENAME COLUMN "settlement_trustee_status" TO "service_fee_trustee_status";
ALTER TABLE "note_settlements" RENAME COLUMN "settlement_trustee_created_at" TO "service_fee_trustee_created_at";
ALTER TABLE "note_settlements" RENAME COLUMN "settlement_trustee_letter_generated_at" TO "service_fee_trustee_letter_generated_at";
ALTER TABLE "note_settlements" RENAME COLUMN "settlement_trustee_submitted_at" TO "service_fee_trustee_submitted_at";
ALTER TABLE "note_settlements" RENAME COLUMN "settlement_trustee_completed_at" TO "service_fee_trustee_completed_at";
ALTER TABLE "note_settlements" RENAME COLUMN "settlement_trustee_email_sent_at" TO "service_fee_trustee_email_sent_at";

ALTER INDEX "note_settlements_settlement_trustee_status_idx" RENAME TO "note_settlements_service_fee_trustee_status_idx";

UPDATE "admin_roles"
SET permissions = array_append(permissions, 'service_fee.view')
WHERE 'settlements.view' = ANY (permissions)
  AND NOT ('service_fee.view' = ANY (permissions));
