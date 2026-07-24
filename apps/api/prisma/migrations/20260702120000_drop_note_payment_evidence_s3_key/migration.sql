-- Drop unused legacy single-key payment proof column (replaced by evidence_files JSONB).
ALTER TABLE "note_payments" DROP COLUMN IF EXISTS "evidence_s3_key";
