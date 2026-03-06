-- Drop review_cycle column from application_review_remarks and restore unique constraint on (application_id, scope, scope_key)
BEGIN;

-- Drop indexes and constraints that reference review_cycle or the old unique
ALTER TABLE IF EXISTS application_review_remarks DROP CONSTRAINT IF EXISTS application_review_remarks_uniq;
ALTER TABLE IF EXISTS application_review_remarks DROP CONSTRAINT IF EXISTS application_review_remarks_application_id_scope_scope_key_key;
ALTER TABLE IF EXISTS application_review_remarks DROP CONSTRAINT IF EXISTS application_review_notes_application_id_review_cycle_idx;
DROP INDEX IF EXISTS application_review_notes_application_id_review_cycle_idx;

-- Drop the review_cycle column if it exists
ALTER TABLE IF EXISTS application_review_remarks DROP COLUMN IF EXISTS review_cycle;

-- Ensure an index exists on (application_id, scope_key)
CREATE INDEX IF NOT EXISTS application_review_notes_application_id_scope_key_idx ON application_review_remarks (application_id, scope_key);

-- Add the original unique constraint on (application_id, scope, scope_key)
ALTER TABLE IF EXISTS application_review_remarks ADD CONSTRAINT application_review_remarks_application_id_scope_scope_key_key UNIQUE (application_id, scope, scope_key);

COMMIT;

