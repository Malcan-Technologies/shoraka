-- Migrate ReviewSection enum from legacy (FINANCIAL, JUSTIFICATION, DOCUMENTS) to step-key based IDs.
-- FINANCIAL -> financial; JUSTIFICATION -> business_details; DOCUMENTS -> supporting_documents.

CREATE TYPE "ReviewSection_new" AS ENUM (
  'financial',
  'business_details',
  'supporting_documents',
  'contract_details',
  'invoice_details',
  'company_details'
);

ALTER TABLE "application_reviews" ADD COLUMN "section_new" "ReviewSection_new";

UPDATE "application_reviews" SET "section_new" = CASE
  WHEN "section"::text = 'FINANCIAL' THEN 'financial'::"ReviewSection_new"
  WHEN "section"::text = 'JUSTIFICATION' THEN 'business_details'::"ReviewSection_new"
  WHEN "section"::text = 'DOCUMENTS' THEN 'supporting_documents'::"ReviewSection_new"
  ELSE 'financial'::"ReviewSection_new"
END;

ALTER TABLE "application_reviews" DROP COLUMN "section";

ALTER TABLE "application_reviews" RENAME COLUMN "section_new" TO "section";

ALTER TABLE "application_reviews" ALTER COLUMN "section" SET NOT NULL;

CREATE UNIQUE INDEX "application_reviews_application_id_section_key" ON "application_reviews"("application_id", "section");

DROP TYPE "ReviewSection";

ALTER TYPE "ReviewSection_new" RENAME TO "ReviewSection";
