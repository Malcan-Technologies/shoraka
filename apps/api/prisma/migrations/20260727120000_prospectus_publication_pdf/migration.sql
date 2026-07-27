-- AlterTable
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_storage_bucket" TEXT;
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_storage_key" TEXT;
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_content_type" TEXT DEFAULT 'application/pdf';
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_size_bytes" INTEGER;
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_sha256" TEXT;
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_generated_at" TIMESTAMP(3);
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_generation_status" TEXT DEFAULT 'PENDING';
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_generation_error" TEXT;
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_snapshot_hash" TEXT;
ALTER TABLE "note_prospectus_publications" ADD COLUMN "pdf_page_count" INTEGER;

-- CreateIndex
CREATE INDEX "note_prospectus_publications_pdf_storage_key_idx" ON "note_prospectus_publications"("pdf_storage_key");
