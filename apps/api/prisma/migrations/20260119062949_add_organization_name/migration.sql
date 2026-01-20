-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrganizationMemberRole" ADD VALUE 'OWNER';
ALTER TYPE "OrganizationMemberRole" ADD VALUE 'DIRECTOR';
ALTER TYPE "OrganizationMemberRole" ADD VALUE 'MEMBER';

-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "business_aml_status" JSONB;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "business_aml_status" JSONB;

-- AlterTable
ALTER TABLE "onboarding_logs" ADD COLUMN     "organization_name" TEXT;

-- CreateIndex
CREATE INDEX "onboarding_logs_organization_name_idx" ON "onboarding_logs"("organization_name");
