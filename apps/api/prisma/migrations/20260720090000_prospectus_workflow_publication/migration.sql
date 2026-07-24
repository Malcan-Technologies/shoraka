-- AlterEnum ProspectusReviewStatus
ALTER TYPE "ProspectusReviewStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';

-- AlterEnum SiteDocumentType
ALTER TYPE "SiteDocumentType" ADD VALUE IF NOT EXISTS 'PRODUCT_TERMS';

-- AlterTable note_prospectus_reviews
ALTER TABLE "note_prospectus_reviews" ADD COLUMN IF NOT EXISTS "approved_snapshot" JSONB;
ALTER TABLE "note_prospectus_reviews" ADD COLUMN IF NOT EXISTS "approved_publication_id" TEXT;
ALTER TABLE "note_prospectus_reviews" ADD COLUMN IF NOT EXISTS "render_fingerprint" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "note_prospectus_reviews_approved_publication_id_key"
  ON "note_prospectus_reviews"("approved_publication_id");

-- CreateTable note_prospectus_publications
CREATE TABLE IF NOT EXISTS "note_prospectus_publications" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "prospectus_review_id" TEXT NOT NULL,
    "content_version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "render_fingerprint" TEXT NOT NULL,
    "approved_by_user_id" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_prospectus_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "note_prospectus_publications_note_id_idx"
  ON "note_prospectus_publications"("note_id");
CREATE INDEX IF NOT EXISTS "note_prospectus_publications_prospectus_review_id_idx"
  ON "note_prospectus_publications"("prospectus_review_id");
CREATE INDEX IF NOT EXISTS "note_prospectus_publications_published_at_idx"
  ON "note_prospectus_publications"("published_at");

ALTER TABLE "note_prospectus_publications"
  DROP CONSTRAINT IF EXISTS "note_prospectus_publications_note_id_fkey";
ALTER TABLE "note_prospectus_publications"
  ADD CONSTRAINT "note_prospectus_publications_note_id_fkey"
  FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "note_prospectus_publications"
  DROP CONSTRAINT IF EXISTS "note_prospectus_publications_prospectus_review_id_fkey";
ALTER TABLE "note_prospectus_publications"
  ADD CONSTRAINT "note_prospectus_publications_prospectus_review_id_fkey"
  FOREIGN KEY ("prospectus_review_id") REFERENCES "note_prospectus_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable note_investments
ALTER TABLE "note_investments" ADD COLUMN IF NOT EXISTS "prospectus_publication_id" TEXT;
ALTER TABLE "note_investments" ADD COLUMN IF NOT EXISTS "prospectus_content_version" INTEGER;
ALTER TABLE "note_investments" ADD COLUMN IF NOT EXISTS "prospectus_acknowledged_at" TIMESTAMP(3);
ALTER TABLE "note_investments" ADD COLUMN IF NOT EXISTS "product_terms_ref" TEXT;
ALTER TABLE "note_investments" ADD COLUMN IF NOT EXISTS "risk_disclosure_ref" TEXT;

CREATE INDEX IF NOT EXISTS "note_investments_prospectus_publication_id_idx"
  ON "note_investments"("prospectus_publication_id");

ALTER TABLE "note_investments"
  DROP CONSTRAINT IF EXISTS "note_investments_prospectus_publication_id_fkey";
ALTER TABLE "note_investments"
  ADD CONSTRAINT "note_investments_prospectus_publication_id_fkey"
  FOREIGN KEY ("prospectus_publication_id") REFERENCES "note_prospectus_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
