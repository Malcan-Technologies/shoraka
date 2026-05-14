-- Drop guarantor relationship fields columns.
-- Relationship values are stored inside application_guarantors.source_data instead.
BEGIN;

ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "relationship";
ALTER TABLE "application_guarantors" DROP COLUMN IF EXISTS "relationship_other";

COMMIT;

