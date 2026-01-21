-- AlterTable
ALTER TABLE "onboarding_logs" ADD COLUMN     "investor_organization_id" TEXT,
ADD COLUMN     "issuer_organization_id" TEXT;

-- CreateIndex
CREATE INDEX "onboarding_logs_investor_organization_id_idx" ON "onboarding_logs"("investor_organization_id");

-- CreateIndex
CREATE INDEX "onboarding_logs_issuer_organization_id_idx" ON "onboarding_logs"("issuer_organization_id");

-- AddForeignKey
ALTER TABLE "onboarding_logs" ADD CONSTRAINT "onboarding_logs_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_logs" ADD CONSTRAINT "onboarding_logs_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
