-- AlterTable
ALTER TABLE "investor_organizations" ADD COLUMN     "is_sophisticated_investor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aml_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tnc_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deposit_received" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ssm_approved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "issuer_organizations" ADD COLUMN     "onboarding_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aml_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tnc_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ssm_checked" BOOLEAN NOT NULL DEFAULT false;
