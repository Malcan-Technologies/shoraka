-- Settlement trustee workflow timeline timestamps (created, letter generated) + backfill legacy rows
ALTER TABLE "note_settlements" ADD COLUMN "service_fee_trustee_created_at" TIMESTAMP(3);
ALTER TABLE "note_settlements" ADD COLUMN "service_fee_trustee_letter_generated_at" TIMESTAMP(3);

UPDATE "note_settlements"
SET "service_fee_trustee_created_at" = "posted_at"
WHERE "service_fee_trustee_status" IS NOT NULL
  AND "posted_at" IS NOT NULL
  AND "service_fee_trustee_created_at" IS NULL;

UPDATE "note_settlements" AS ns
SET "service_fee_trustee_letter_generated_at" = sub.letter_at
FROM (
  SELECT
    (ne."metadata"::jsonb ->> 'settlementId') AS settlement_id,
    MAX(ne."created_at") AS letter_at
  FROM "note_events" AS ne
  WHERE ne."event_type" = 'SERVICE_FEE_TRUSTEE_LETTER_GENERATED'
    AND ne."metadata"::jsonb ? 'settlementId'
  GROUP BY (ne."metadata"::jsonb ->> 'settlementId')
) AS sub
WHERE ns."id" = sub.settlement_id
  AND ns."service_fee_trustee_letter_generated_at" IS NULL;

UPDATE "note_settlements" AS ns
SET "service_fee_trustee_submitted_at" = ne."created_at"
FROM "note_events" AS ne
WHERE ne."note_id" = ns."note_id"
  AND ne."event_type" = 'SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED'
  AND (ne."metadata"::jsonb ->> 'settlementId') = ns."id"
  AND ns."service_fee_trustee_submitted_at" IS NULL
  AND ns."service_fee_trustee_status" IN ('SUBMITTED_TO_TRUSTEE', 'COMPLETED');

UPDATE "note_settlements" AS ns
SET "service_fee_trustee_completed_at" = COALESCE(
  NULLIF(ne."metadata"::jsonb ->> 'completedAt', '')::timestamptz,
  ne."created_at"
)
FROM "note_events" AS ne
WHERE ne."note_id" = ns."note_id"
  AND ne."event_type" = 'SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED'
  AND (ne."metadata"::jsonb ->> 'settlementId') = ns."id"
  AND ns."service_fee_trustee_completed_at" IS NULL
  AND ns."service_fee_trustee_status" = 'COMPLETED';
