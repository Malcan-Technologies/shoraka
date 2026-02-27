-- Unify ApplicationPendingAmendment into ApplicationReviewRemark with submitted_at
-- Pending amendments = ApplicationReviewRemark where action_type='REQUEST_AMENDMENT' and submitted_at IS NULL

-- 1. Add submitted_at to application_review_remarks (nullable)
ALTER TABLE "application_review_remarks" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ NULL;

-- 2. Treat existing remarks as sent (they were created on Proceed or direct request)
UPDATE "application_review_remarks" SET "submitted_at" = "created_at" WHERE "submitted_at" IS NULL;

-- 2b. Add index for pending amendments query (submitted_at IS NULL)
CREATE INDEX IF NOT EXISTS "application_review_remarks_application_id_submitted_at_idx"
  ON "application_review_remarks"("application_id", "submitted_at");

-- 3. Add author FK for includes (optional, enables author join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'application_review_remarks_author_user_id_fkey'
  ) THEN
    ALTER TABLE "application_review_remarks"
      ADD CONSTRAINT "application_review_remarks_author_user_id_fkey"
      FOREIGN KEY ("author_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Migrate application_pending_amendments to application_review_remarks with submitted_at=NULL
INSERT INTO "application_review_remarks" (
  "id", "application_id", "scope", "scope_key", "action_type", "remark",
  "author_user_id", "created_at", "updated_at", "submitted_at"
)
SELECT
  gen_random_uuid()::text,
  "application_id", "scope", "scope_key", 'REQUEST_AMENDMENT', "remark",
  "author_user_id", "created_at", "updated_at", NULL
FROM "application_pending_amendments"
ON CONFLICT ("application_id", "scope", "scope_key")
DO UPDATE SET
  "remark" = EXCLUDED."remark",
  "author_user_id" = EXCLUDED."author_user_id",
  "updated_at" = EXCLUDED."updated_at",
  "submitted_at" = NULL;

-- 5. Update section status for migrated section-scope pending amendments
UPDATE "application_reviews" r
SET "status" = 'AMENDMENT_REQUESTED'
FROM "application_review_remarks" rem
WHERE rem."application_id" = r."application_id"
  AND rem."scope" = 'section'
  AND rem."scope_key" = r."section"::text
  AND rem."submitted_at" IS NULL;

-- 6. Upsert ApplicationReviewItem for migrated item-scope pending amendments
-- scope_key format: "itemType:itemId" (e.g. "document:doc:cat:0:slug")
INSERT INTO "application_review_items" (
  "id", "application_id", "item_type", "item_id", "status",
  "reviewer_user_id", "reviewed_at", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  rem."application_id",
  split_part(rem."scope_key", ':', 1),
  substring(rem."scope_key" from position(':' in rem."scope_key") + 1),
  'AMENDMENT_REQUESTED',
  rem."author_user_id",
  now(),
  now(),
  now()
FROM "application_review_remarks" rem
WHERE rem."scope" = 'item'
  AND rem."submitted_at" IS NULL
ON CONFLICT ("application_id", "item_type", "item_id")
DO UPDATE SET
  "status" = 'AMENDMENT_REQUESTED',
  "reviewer_user_id" = EXCLUDED."reviewer_user_id",
  "reviewed_at" = now(),
  "updated_at" = now();

-- 7. Drop application_pending_amendments (cascades drop FKs)
DROP TABLE IF EXISTS "application_pending_amendments";
