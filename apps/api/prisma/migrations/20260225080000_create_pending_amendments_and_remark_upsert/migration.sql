-- Create application_pending_amendments table for draft amendment workflow
CREATE TABLE "application_pending_amendments" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL,
    "item_type" TEXT,
    "item_id" TEXT,
    "remark" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "application_pending_amendments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_pending_amendments_application_id_scope_scope_key_key"
    ON "application_pending_amendments"("application_id", "scope", "scope_key");
CREATE INDEX "application_pending_amendments_application_id_idx"
    ON "application_pending_amendments"("application_id");

ALTER TABLE "application_pending_amendments"
    ADD CONSTRAINT "application_pending_amendments_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_pending_amendments"
    ADD CONSTRAINT "application_pending_amendments_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add updated_at to application_review_remarks (for upsert semantics)
ALTER TABLE "application_review_remarks" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Dedupe: delete older rows, keep the most recent per (application_id, scope, scope_key)
DELETE FROM "application_review_remarks" a
USING "application_review_remarks" b
WHERE a.application_id = b.application_id
  AND a.scope = b.scope
  AND a.scope_key = b.scope_key
  AND a.created_at < b.created_at;

-- Add unique constraint for single-current-row semantics
CREATE UNIQUE INDEX IF NOT EXISTS "application_review_remarks_application_id_scope_scope_key_key"
    ON "application_review_remarks"("application_id", "scope", "scope_key");

-- Drop the non-unique index if it exists (we may have application_id, scope_key only - check current indexes)
-- The plan says scope_key - but we need (application_id, scope, scope_key) for uniqueness.
-- Existing index: application_review_notes_application_id_scope_key_idx on (application_id, scope_key)
-- We're adding a new unique index. The old index can stay for queries that filter by application_id + scope_key
-- but the unique one covers (app, scope, scope_key). Leave the old index for now unless it conflicts.
