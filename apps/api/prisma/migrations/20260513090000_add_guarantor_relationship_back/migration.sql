-- Re-introduce guarantor relationship fields for Business & Guarantor Details step.
BEGIN;

ALTER TABLE "application_guarantors" ADD COLUMN IF NOT EXISTS "relationship" TEXT;
ALTER TABLE "application_guarantors" ADD COLUMN IF NOT EXISTS "relationship_other" TEXT;

COMMIT;

