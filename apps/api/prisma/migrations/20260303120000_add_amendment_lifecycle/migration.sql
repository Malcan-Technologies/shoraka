-- Migration: add amendment lifecycle fields and ApplicationRevision table
BEGIN;

-- 1) Add review_cycle to applications (default 1)
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "review_cycle" INTEGER NOT NULL DEFAULT 1;

-- 2) Add review_cycle to application_review_remarks with default 1 to backfill existing rows
ALTER TABLE "application_review_remarks" ADD COLUMN IF NOT EXISTS "review_cycle" INTEGER NOT NULL DEFAULT 1;

-- 3) Drop old unique constraint on (application_id, scope, scope_key) if exists
ALTER TABLE "application_review_remarks" DROP CONSTRAINT IF EXISTS "application_review_remarks_application_id_scope_scope_key_key";

-- 4) Add new unique constraint on (application_id, review_cycle, scope_key)
ALTER TABLE "application_review_remarks" ADD CONSTRAINT "application_review_remarks_uniq" UNIQUE ("application_id", "review_cycle", "scope_key");

-- 5) Add index on (application_id, review_cycle)
CREATE INDEX IF NOT EXISTS "application_review_notes_application_id_review_cycle_idx" ON "application_review_remarks"("application_id", "review_cycle");

-- 6) Create application_revisions table
CREATE TABLE IF NOT EXISTS "application_revisions" (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
  review_cycle INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "application_revisions_application_id_review_cycle_idx" ON "application_revisions"("application_id", "review_cycle");
CREATE INDEX IF NOT EXISTS "application_revisions_application_id_idx" ON "application_revisions"("application_id");

COMMIT;

