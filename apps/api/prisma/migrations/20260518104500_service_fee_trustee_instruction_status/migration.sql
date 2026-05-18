-- Service fee trustee instruction workflow (letter → submitted → completed)
CREATE TYPE "ServiceFeeTrusteeInstructionStatus" AS ENUM (
  'PENDING_LETTER',
  'LETTER_GENERATED',
  'SUBMITTED_TO_TRUSTEE',
  'COMPLETED'
);

ALTER TABLE "note_settlements" ADD COLUMN "service_fee_trustee_status" "ServiceFeeTrusteeInstructionStatus";
ALTER TABLE "note_settlements" ADD COLUMN "service_fee_trustee_submitted_at" TIMESTAMP(3);
ALTER TABLE "note_settlements" ADD COLUMN "service_fee_trustee_completed_at" TIMESTAMP(3);

CREATE INDEX "note_settlements_service_fee_trustee_status_idx" ON "note_settlements"("service_fee_trustee_status");

UPDATE "note_settlements"
SET "service_fee_trustee_status" = 'PENDING_LETTER'
WHERE "status" = 'POSTED'
  AND "service_fee_amount" > 0.005;

UPDATE "note_settlements" AS ns
SET "service_fee_trustee_status" = 'LETTER_GENERATED'
FROM "note_events" AS ne
WHERE ns."status" = 'POSTED'
  AND ns."service_fee_amount" > 0.005
  AND ne."note_id" = ns."note_id"
  AND ne."event_type" = 'SERVICE_FEE_TRUSTEE_LETTER_GENERATED'
  AND (ne."metadata"::jsonb ->> 'settlementId') = ns."id";
