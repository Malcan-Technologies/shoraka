-- CreateEnum
CREATE TYPE "ProspectusReviewStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "note_prospectus_reviews" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "status" "ProspectusReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "content_version" INTEGER NOT NULL DEFAULT 1,
    "option_catalogue_version" TEXT NOT NULL,
    "draft_content" JSONB NOT NULL DEFAULT '{}',
    "approved_content" JSONB,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_prospectus_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "note_prospectus_reviews_note_id_key" ON "note_prospectus_reviews"("note_id");

-- CreateIndex
CREATE INDEX "note_prospectus_reviews_status_idx" ON "note_prospectus_reviews"("status");

-- CreateIndex
CREATE INDEX "note_prospectus_reviews_updated_at_idx" ON "note_prospectus_reviews"("updated_at");

-- AddForeignKey
ALTER TABLE "note_prospectus_reviews" ADD CONSTRAINT "note_prospectus_reviews_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
