-- AlterTable
ALTER TABLE "ctos_reports" ADD COLUMN "investor_organization_id" TEXT;

-- AlterTable
ALTER TABLE "ctos_reports" ALTER COLUMN "issuer_organization_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ctos_reports" ADD CONSTRAINT "ctos_reports_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one org FK per row (issuer application flows use issuer_organization_id only; investor org flows use investor_organization_id only).
ALTER TABLE "ctos_reports" ADD CONSTRAINT "ctos_reports_org_fk_xor_ck" CHECK (
  (CASE WHEN "issuer_organization_id" IS NOT NULL THEN 1 ELSE 0 END)
 + (CASE WHEN "investor_organization_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- CreateIndex
CREATE INDEX "ctos_reports_investor_organization_id_idx" ON "ctos_reports"("investor_organization_id");

-- CreateIndex
CREATE INDEX "ctos_reports_investor_organization_id_fetched_at_idx" ON "ctos_reports"("investor_organization_id", "fetched_at" DESC);

-- CreateIndex
CREATE INDEX "ctos_reports_investor_organization_id_subject_ref_fetched_at_idx" ON "ctos_reports"("investor_organization_id", "subject_ref", "fetched_at" DESC);
