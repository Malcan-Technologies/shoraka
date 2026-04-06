-- AlterTable
ALTER TABLE "ctos_reports" ADD COLUMN     "subject_ref" TEXT;

-- CreateIndex
CREATE INDEX "ctos_reports_issuer_organization_id_subject_ref_fetched_at_idx" ON "ctos_reports"("issuer_organization_id", "subject_ref", "fetched_at" DESC);
