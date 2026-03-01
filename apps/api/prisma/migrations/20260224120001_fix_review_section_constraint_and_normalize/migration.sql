-- Fix: 1) Add missing unique constraint (dropped during enum migration)
--      2) Normalize FINANCIAL -> financial for consistency with other section IDs

-- Add unique index if not exists (handles case where original migration ran without it)
CREATE UNIQUE INDEX IF NOT EXISTS "application_reviews_application_id_section_key"
  ON "application_reviews"("application_id", "section");

-- Normalize FINANCIAL -> financial via enum migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ReviewSection' AND e.enumlabel = 'FINANCIAL'
  ) THEN
    CREATE TYPE "ReviewSection_new" AS ENUM (
      'financial', 'business_details', 'supporting_documents',
      'contract_details', 'invoice_details', 'company_details'
    );
    ALTER TABLE "application_reviews" ADD COLUMN "section_new" "ReviewSection_new";
    UPDATE "application_reviews" SET "section_new" = CASE
      WHEN "section"::text = 'FINANCIAL' THEN 'financial'::"ReviewSection_new"
      ELSE "section"::text::"ReviewSection_new"
    END;
    ALTER TABLE "application_reviews" DROP COLUMN "section";
    ALTER TABLE "application_reviews" RENAME COLUMN "section_new" TO "section";
    ALTER TABLE "application_reviews" ALTER COLUMN "section" SET NOT NULL;
    DROP TYPE "ReviewSection";
    ALTER TYPE "ReviewSection_new" RENAME TO "ReviewSection";
    CREATE UNIQUE INDEX IF NOT EXISTS "application_reviews_application_id_section_key"
      ON "application_reviews"("application_id", "section");
  END IF;
END $$;
